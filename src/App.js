import './App.css';
import {faPlus, faFileImport} from '@fortawesome/free-solid-svg-icons'
import 'bootstrap/dist/css/bootstrap.min.css';
import FileSearch from "./components/FileSearch";
import FileList from "./components/FileList";
import BottomBtn from "./components/BottomBtn";
import TabList from "./components/TabList";
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import {useState} from "react";
import uuidv4 from 'uuid/dist/v4';
import {flattenArr, objToArr,timestampTpString} from './utils/help';
import fileHelper from "./utils/fileHelper";
import useIpcRenderer from "./hooks/useIpcRenderer";
import Loader from "./components/Loader";


//require nodejs modules
const {join,basename,extname}=window.require('path')
const {remote,ipcRenderer}=window.require('electron')
const Store=window.require('electron-store')
const fileStore=new Store({'name':'Files Data'})
const settingsStore = new Store({ name: 'Settings'})
const getAutoSync=()=>['accessKey', 'secretKey', 'bucketName', 'enableAutoSync'].every(key => !!settingsStore.get(key))

const saveFilesToStore=(files)=>{
    // we dont need to save all info to file system ,eg: isNew body,etc
    const filesStoreObj=objToArr(files).reduce((result,file)=>{
        const {id,path,title,createAt,body,isSynced,updatedAt}=file
        result[id]={
            id,
            path,
            title,
            createAt,
            body,
            isSynced,
            updatedAt
        }
        return result
    },{})
    fileStore.set('files',filesStoreObj)
}

function App() {
    const [files, setFiles] = useState(fileStore.get('files')|| {})
    const [activeFileID, setActiveFileID] = useState('')
    const [openedFileIDS, setOpenedFileIDs] = useState([])
    const [unsavedFileIDs, setUnsavedFileIDs] = useState([])
    const [searchedFiles,setSearchFiles]=useState([])
    const [isLoading,setLoading]=useState(false)
    const settingsStore=new Store({name:'Settings'})
    const savedLocation=settingsStore.get('savedFileLocation') || remote.app.getPath('documents')
    const filesArr=objToArr(files)
    const activeFile = files[activeFileID]
    const fileListArray=(searchedFiles.length>0)?searchedFiles:filesArr
    const openedFiles = openedFileIDS.map(openID=>{
        return files[openID]
    })

    const fileClick=(fileID)=>{
        setActiveFileID(fileID)
        const currentFile=files[fileID]
        const {id,title,path,isLoaded,isNew}=currentFile
        if(!isNew){
            if(!isLoaded){
                if(getAutoSync()){
                    ipcRenderer.send('download-file', { key: `${title}.md`, path, id })
                }else {
                    fileHelper.readFile(currentFile.path).then(value=>{
                        const newFile={...files[fileID],body:value,isLoaded:true}
                        setFiles({...files,[fileID]:newFile})
                    })
                }
            }
            //如果openedfiles dont have current id
            if(!openedFileIDS.includes(fileID)){
                setOpenedFileIDs([...openedFileIDS,fileID])
            }
        }
    }
    const tabClick=(fileID)=>{
        setActiveFileID(fileID)
    }
    const tabClose=(id)=>{
        const tabsWithout=openedFileIDS.filter(fileID=>fileID!==id)
        setOpenedFileIDs(tabsWithout)
        // set the active to the first opened tab
        if(tabsWithout.length>0){
            setActiveFileID(tabsWithout[0])
        }else {
            setActiveFileID('')
        }
    }
    const fileChange=(id,value)=>{
        if(value!==files[id].body){
            const newFile={...files[id],body:value}
            setFiles({...files, [id]: newFile})
            // update unsavedIDs
            if(!unsavedFileIDs.includes(id)){
                setUnsavedFileIDs([...unsavedFileIDs,id])
            }
        }
    }
    const deleteFile=(fileId)=>{
        const currentFile=files[fileId]
        const {id,title,isNew}=currentFile
        if(isNew){
            const {[id]:value, ...afterDelete}=files
            setFiles(afterDelete)
        }else {
            if(getAutoSync()){
                ipcRenderer.send('delete-file',{ key: `${title}.md`,id},)
            }else {
                fileHelper.deleteFile(join(savedLocation,`${files[id].title}.md`)).then(()=>{
                    const {[id]:value, ...afterDelete}=files
                    setFiles(afterDelete)
                    saveFilesToStore(afterDelete)
                    // close tab if tabs opened
                    tabClose(id)
                })
            }
        }
    }
    const updateFileName=(id,title,isNew,oldTitle)=>{
        // newPath should be different based on isNew
        // if isNew is false path should be old dirname + new title
        const newPath=join(savedLocation,`${title}.md`)
        const modifiedFile={...files[id],title,isNew: false,path:newPath}
        const newFile={...files,[id]:modifiedFile}
        if(isNew){
            fileHelper.writeFile(newPath,files[id].body).then(()=>{
                setFiles(newFile)
                saveFilesToStore(newFile)
            })
            if(getAutoSync()){
                ipcRenderer.send('create-file',{key:`${title}.md`,path:newPath,isNew:isNew})
            }
        }else {
            const oldPath=files[id].path
            fileHelper.renameFile(oldPath,newPath).then(() => {
                setFiles(newFile)
                saveFilesToStore(newFile)
            })
            if(getAutoSync()){
                ipcRenderer.send('create-file',{key:`${title}.md`,path:newPath,isNew:false,oldKey:`${oldTitle}.md`})
            }
        }
    }
    const fileSearch=(keyword)=>{
        // filter out the new files based on the keyword
        const newFiles=filesArr.filter(file=>file.title.includes(keyword))
        setSearchFiles(newFiles)
    }
    const createNewFile=()=>{
        const newID=uuidv4()
        const newFile={
            id:newID,
            title:'',
            body:'## 请输入markdown',
            createAt:new Date().toISOString(),
            isNew:true
        }
        setFiles({...files,[newID]:newFile})
    }
    const saveCurrentFile=()=>{
        const {path,title}=activeFile
        fileHelper.writeFile(activeFile.path,
            activeFile.body
        ).then(()=>{
            const newFile={...files,[activeFileID]:activeFile}
            saveFilesToStore(newFile)
            setUnsavedFileIDs(unsavedFileIDs.filter(id=>id!==activeFile.id))
            if(getAutoSync()){
                ipcRenderer.send('upload-file',{key:`${title}.md`,path})
            }
        })
    }
    const importFiles=()=>{
        remote.dialog.showOpenDialog({
            title:'选择导入的Markdown文件',
            properties:["openFile","multiSelections"],
            filters:[{
                name:"Markdown files",extensions:['md']
            }]
        }).then((result)=>{
            const paths=result.filePaths
            if(Array.isArray(paths)){
            //    我们要扩展这个数据 将我们的id title等都加进去
                const filteredPaths=paths.filter(path=>{
                    const alreadyAdded=Object.values(files).find(file=>{
                        return file.path===path
                    })
                    return !alreadyAdded
                })
            //    【{id:'1',path:'',title:''},{}】

                const importFilesArr=filteredPaths.map(path=>{
                    return {
                        id:uuidv4(),
                        title:basename(path,extname(path)),
                        path
                    }
                })
            //    get the new files object in flattenArr
                const newFiles={...files,...flattenArr(importFilesArr)}
            //    setState and update electron store
                setFiles(newFiles)
                saveFilesToStore(newFiles)
            //    message box tell users import success
                if(importFilesArr.length>0){
                    remote.dialog.showMessageBox({
                        type:'info',
                        title:`成功导入了${importFilesArr.length}个文件`,
                        message:`成功导入了${importFilesArr.length}个文件`
                    })
                }
            // 如果是自动同步，我们需要在处理完本地的文件之后进行一次全部文件同步
                if(getAutoSync()){
                    ipcRenderer.send('upload-all-to-qiniu')
                }
            }
        })
    }

    const activeFileUploaded=()=>{
        const {id}=activeFile
        const modifiedFile={...files[id],isSynced:true,updatedAt:new Date().getTime()}
        const newFiles={...files,[id]:modifiedFile}
        setFiles(newFiles)
        saveFilesToStore(newFiles)
    }

    const activeFileDownloaded=(event,message)=>{
        if(message.id){
            const currentFile=files[message.id]
            const {id,path}=currentFile
            fileHelper.readFile(path).then(value=>{
                let newFile
                if(message.status==='download-success'){
                    newFile={...files[id],body:value,isLoaded:true,isSynced: true,updatedAt: new Date().getTime()}
                }else {
                    newFile={...files[id],body:value,isLoaded:true}
                }
                const newFiles={...files,[id]:newFile}
                setFiles(newFiles)
                saveFilesToStore(newFiles)
            })
        }
    }

    const filesUploaded=()=>{
        const newFiles=objToArr(files).reduce((result,file)=>{
            const currentTime=new Date().getTime()
            result[file.id]={
                ...files[file.id],
                isSynced:true,
                updatedAt:currentTime
            }
            return result
        },{})
        setFiles(newFiles)
        saveFilesToStore(newFiles)
    }

    const filesDeleted=(event,message)=>{
        if(message.id){
            const {id}=message
            fileHelper.deleteFile(join(savedLocation,`${files[id].title}.md`)).then(()=>{
                const {[id]:value, ...afterDelete}=files
                setFiles(afterDelete)
                saveFilesToStore(afterDelete)
            })
        }
    }

    const allFilesUpdated=(event,message)=>{
        console.log(message)
        const filesArr=objToArr(message.data)
        console.log(filesArr)
        filesArr.forEach(file=>{
            const {id,path}=file
            console.log(path)
            fileHelper.readFile(path).then(value=>{
                let newFile={...files[id],body:value,isLoading:true,isSynced:true,updatedAt:new Date().getTime()}
                file=newFile
            })
        })
        const newFiles=flattenArr(filesArr)
        setFiles(newFiles)
        saveFilesToStore(newFiles)
    }

    useIpcRenderer({
        'create-new-file':createNewFile,
        'import-file':importFiles,
        'save-edit-file':saveCurrentFile,
        'active-file-uploaded':activeFileUploaded,
        'file-downloaded':activeFileDownloaded,
        'loading-status':(message,status)=>{setLoading(status)},
        'files-uploaded':filesUploaded,
        'file-deleted':filesDeleted,
        'update-all-files':allFilesUpdated
    })

    return (
        <div className="App container-fluid px-0">
            {isLoading &&  <Loader/>}
            <div className="row no-gutters">
                <div className='col-3 bg-light left-panel'>
                    <FileSearch title='我的云文档' onFileSearch={fileSearch}/>
                    <FileList
                        files={fileListArray}
                        onFileClick={fileClick}
                        onFileDelete={deleteFile}
                        onSaveEdit={updateFileName}
                    />
                    <div className="row no-gutters button-group">
                        <div className='col'>
                            <BottomBtn text="新建"
                                       colorClass="btn-primary"
                                       icon={faPlus}
                                       onBtnClick={createNewFile}
                            >
                            </BottomBtn>
                        </div>
                        <div className='col'>
                            <BottomBtn text="导入"
                                       colorClass="btn-success"
                                       onBtnClick={importFiles}
                                       icon={faFileImport}>
                            </BottomBtn>
                        </div>
                    </div>
                </div>
                <div className="col-9 right-panel">
                    {!activeFile &&
                    <div className="start-page">
                        选择或者创建新的markdown文档
                    </div>}
                    {
                        activeFile && <>
                            <TabList files={openedFiles}
                                     activeId={activeFileID}
                                     onTabClick={tabClick}
                                     onCloseTab={tabClose}
                                     unSaveIds={unsavedFileIDs}
                            />
                            <SimpleMDE
                                onChange={(value)=>fileChange(activeFile.id,value)}
                                value={activeFile && activeFile.body}
                                       options={{
                                           minHeight: '400px'
                                       }}
                            />
                            {activeFile.isSynced && <span className="sync-status">
                                已同步，上次同步{timestampTpString(activeFile.updatedAt)}
                            </span>}
                        </>
                    }
                </div>
            </div>
        </div>
    );
}

export default App;
