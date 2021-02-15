const {app, Menu, ipcMain, dialog, remote} = require('electron')
const fs=require('fs').promises
const isDev = require('electron-is-dev')
const _path = require('path')
const menuTemplate = require('./src/menuTemplate')
const AppWindow = require('./src/AppWindow')
const Store = require('electron-store')
const QiniuManager = require('./src/utils/QiniuManager')
const settingsStore = new Store({name: 'Settings'})
const savedLocation = settingsStore.get('savedFileLocation') || remote.app.getPath('documents')
const fileStore = new Store({name: 'Files Data'})
const {v4: uuidv4}=require('node-uuid')
let mainWindow, settingsWindow
const createManager = () => {
    const accessKey = settingsStore.get('accessKey')
    const secretKey = settingsStore.get('secretKey')
    const bucketName = settingsStore.get('bucketName')
    return new QiniuManager(accessKey, secretKey, bucketName)
}
app.on('ready', () => {
    const mainWindowConfig = {
        minWidth: 1024,
        minHeight: 680
    }
    const urlLocation = isDev ? 'http://localhost:3000' : `file://${_path.join(__dirname,'./index.html')}`
    mainWindow = new AppWindow(mainWindowConfig, urlLocation)
    mainWindow.on('close', () => {
        mainWindow = null
    })
    //    set the menu
    let menu = Menu.buildFromTemplate(menuTemplate)
    Menu.setApplicationMenu(menu)
//    hook main events
//    打开设置窗口
    ipcMain.on('open-settings-window', () => {
        const settingsWindowConfig = {
            minWidth: 500,
            minHeight: 400,
            parent: mainWindow
        }
        const settingsFileLocation = `file://${_path.join(__dirname, './settings/settings.html')}`
        settingsWindow = new AppWindow(settingsWindowConfig, settingsFileLocation)
        settingsWindow.removeMenu()
        settingsWindow.on('closed', () => {
            settingsWindow = null
        })
    })
    //保存配置
    ipcMain.on('config-is-saved', () => {
        //    watch out menu items index for mac and windows
        let qiniuMenu = process.platform === 'darwin' ? menu.items[3] : menu.items[2]
        const switchItems = (toggle) => {
            [1, 2, 3].forEach(number => {
                qiniuMenu.submenu.items[number].enabled = toggle
            })
        }
        const qiniuIsConfiged = ['accessKey', 'secretKey', 'bucketName'].every(key => !!settingsStore.get(key))
        if (qiniuIsConfiged) {
            switchItems(true)
        } else {
            switchItems(false)
        }
    })
    // 更新文件,更新文件需要先云同步,然后react端去修改本地文件
    ipcMain.on('upload-file', (event, data) => {
        const manager = createManager()
        const {key, path} = data
        manager.uploadFile(key, path).then(data => {
            console.log('上传成功', data)
            mainWindow.webContents.send('active-file-uploaded')
        }).catch((err) => {
            console.log(err)
            dialog.showErrorBox(`${err}`, '请检查七牛云参数是否正确')
        })
    })
    //创建文件和重命名文件,需要react端先修改本地文件,再上传,要不然上传会找不到这个路径的
    ipcMain.on('create-file', (event, data) => {
        const manager = createManager()
        const {key,path,isNew,oldKey} = data
        if(isNew){
            manager.uploadFile(key, path).then(data => {
                console.log('上传成功', data)
            }).catch((err) => {
                dialog.showErrorBox(`${err}`, '请检查七牛云参数是否正确')
            })
        }else {
            manager.renameFile(oldKey,key).then(()=>{
                console.log('重命名成功')
            }).catch(err=>{
                dialog.showErrorBox(`${err}`,'请先将文件同步至七牛云或者检查七牛云参数')
            })
        }
    })
    ipcMain.on('download-file', (event, data) => {
        const manager = createManager()
        const filesObj = fileStore.get('files')
        const {key, path, id} = data
        manager.getStat(data.key).then((response) => {
            const serverUpdatedTime = Math.round(response.putTime / 10000)
            const localUpdatedTime = filesObj[id].updatedAt
            if (serverUpdatedTime > localUpdatedTime || !localUpdatedTime) {
                manager.downloadFile(key, path).then(() => {
                    mainWindow.webContents.send('file-downloaded',
                        {status: 'download-success', id})
                })
            } else {
                mainWindow.webContents.send('file-downloaded',
                    {status: 'no-new-file', id})
            }
        }, (error) => {
            console.log(error)
            if (error.statusCode === 612) {
                mainWindow.webContents.send('file-downloaded', {status: 'no-file'})
            }
        })
    })
    ipcMain.on('delete-file', (event, data) => {
        const manager = createManager()
        const {key, id} = data
        manager.getStat(key).then(() => {
            manager.deleteFile(key).then(() => {
                dialog.showMessageBox({
                    type: 'info',
                    title: `删除成功`,
                    message: `删除成功`
                })
                mainWindow.webContents.send('file-deleted', {status: 'delete-success', id})
            })
        }, (err) => {
            console.log(err)
            if (err.statusCode === 612) {
                dialog.showErrorBox('删除失败', '请先将文件同步至七牛云')
            }
        })

    })
    ipcMain.on('upload-all-to-qiniu', () => {
        mainWindow.webContents.send('loading-status', true)
        const manager = createManager()
        const filesObj = fileStore.get('files') || {}
        const uploadPromiseArr = Object.keys(filesObj).map(key => {
            const file = filesObj[key]
            return manager.uploadFile(`${file.title}.md`, file.path)
        })
        Promise.all(uploadPromiseArr).then(result => {
            //    show uploaded message
            dialog.showMessageBox({
                type: 'info',
                title: `成功上传了${result.length}个文件`,
                message: `成功上传了${result.length}个文件`
            })
            mainWindow.webContents.send('files-uploaded')
        }).catch(() => {
            dialog.showErrorBox('同步失败', '请检查七牛云参数是否正确')
        }).finally(() => {
            mainWindow.webContents.send('loading-status', false)
        })
    })
//    下载所有文件到本地
    ipcMain.on('download-all-to-local', () => {
        mainWindow.webContents.send('loading-status', true)
        const manager = createManager()
        const currentFilesObj = fileStore.get('files') || {}
        const currentFilesKeyList = Object.keys(currentFilesObj).map(key=>currentFilesObj[key].title)
        //    step 1 获取文件列表
        manager.getFileList().then(data => {
            const {items}=data
            //    step 2 和本地文件对比判断是否要下载，应该包括比本地新的，本地没有的
            const newFilesArr= items.filter(item => {
                if (!currentFilesKeyList.includes(item.key.substring(0,item.key.length-3))) {
                    return item
                }
            })
            const qiniuFilesArr=newFilesArr.map(item => {
                //    step3 使用文件列表生成下载文件的promise数组
                const path = _path.join(savedLocation, `${item.key}`)
                const defaultContent='write markdown'
                fs.writeFile(path,defaultContent,{encoding:'utf8'})
                return  manager.downloadFile(item.key, path)
            })
            Promise.all(qiniuFilesArr).then(()=>{
                const finalFilesObj=newFilesArr.reduce((newFilesObj,qiniuFile)=>{
                        const newId=uuidv4()
                        const newItem={
                            id:newId,
                            path:_path.join(savedLocation, `${qiniuFile.key}`),
                            title:qiniuFile.key.substring(0,qiniuFile.key.length-3),
                            createAt:new Date().getTime(),
                            body:'请输入markdown',
                            isSynced: true,
                            updatedAt:new Date().getTime()
                        }
                        return  {
                            ...newFilesObj,[newId]:newItem
                        }
                },{...currentFilesObj})
                mainWindow.webContents.send('update-all-files',{status:'success',data:finalFilesObj})
            }).catch(()=>{
                mainWindow.webContents.send('update-all-files',{status:'failed'})
            }).finally(()=>{
                mainWindow.webContents.send('loading-status', false)
            })
        })
    })
})