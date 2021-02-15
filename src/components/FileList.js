import React, {useState, useEffect} from "react";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faMarkdown} from '@fortawesome/free-brands-svg-icons'
import {faTimes} from '@fortawesome/free-solid-svg-icons'
import PropTypes from 'prop-types';
import useKeyPress from "../hooks/useKeyPress";
import {useRef} from "react";
import useContextMenu from "../hooks/useContextMenu";
import {getParentNode} from '../utils/help';

//load nodejs module
const {remote} = window.require('electron')

const FileList = ({files, onFileClick, onSaveEdit, onFileDelete}) => {
    const [editStatus, setEditStatus] = useState(false)
    const [value, setValue] = useState('')
    const onEnterPress = useKeyPress(13)
    const onEscPress = useKeyPress(27)
    const node = useRef(null)
    const closeSearch = (editItem) => {
        setEditStatus(false)
        setValue('')
        // if we are editing a newly created file,we should delete this file
        if (editItem && editItem.isNew) {
            onFileDelete(editItem.id)
        }
    }
    // 完成编辑标题，新建文件
    useEffect(() => {
        const editItem = files.find(file => file.id === editStatus)
        if (onEnterPress && editStatus && value.trim() !== '') {
            if (files.filter(file => file.title === value).length) {
                remote.dialog.showMessageBox({
                    type: 'warning',
                    title: '不要输入重复的文件名',
                    message: '不要输入重复的文件名'
                })
                closeSearch(editItem)
            } else {
                onSaveEdit(editItem.id, value, editItem.isNew,editItem.title)
                closeSearch()
            }
        } else if (onEscPress && editStatus) {
            closeSearch(editItem)
        }
    })
    // 进入新建文件
    useEffect(() => {
        const newFile = files.find(file => file.isNew)
        if (newFile) {
            setEditStatus(newFile.id)
            setValue(newFile.title)
        }
    }, [files])
    //编辑状态自动获取焦点
    useEffect(() => {
        if (editStatus) {
            node.current.focus()
        }
    }, [editStatus])
    const itemArr = [{
        label: '打开',
        click: () => {
            const parentElement = getParentNode(clickedItem.current, 'file-item')
            if (parentElement) {
                onFileClick(parentElement.dataset.id)
                setValue(parentElement.dataset.title)
            }
        }
    }, {
        label: '重命名',
        click: () => {
            const parentElement = getParentNode(clickedItem.current, 'file-item')
            if (parentElement) {
                setEditStatus(parentElement.dataset.id)
            }
        }
    }, {
        label: '删除',
        click: () => {
            const parentElement = getParentNode(clickedItem.current, 'file-item')
            if (parentElement) {
                onFileDelete(parentElement.dataset.id)
            }
        }
    }]
    const clickedItem = useContextMenu(itemArr, '.file-list', [files])
    return (
        <ul className="list-group list-group-flush file-list">
            {
                files.map(file => {
                    return <li className="list-group-item
                    file-item"
                               key={file.id}
                               data-id={file.id}
                               data-title={file.title}
                    >
                        {
                            ((file.id !== editStatus) && !file.isNew) ?
                                <div className='d-flex
                    align-items-center'>
                            <span className='col-2'>
                                <FontAwesomeIcon
                                    icon={faMarkdown}
                                    size="lg"
                                />
                            </span>
                                    <span className='col-10 c-link ml-2'
                                          onClick={() => {
                                              onFileClick(file.id)
                                          }}>
                                {file.title}
                            </span>
                                </div> :
                                <div className='d-flex
                    align-items-center'>
                                    <span
                                        className='col-10'
                                        onClick={() => {
                                            onFileClick(file.id)
                                        }}
                                    >
                                        <input type="text"
                                               className="form-control"
                                               value={value}
                                               ref={node}
                                               placeholder='请输入文件名称'
                                               onChange={(e) => {
                                                   setValue(e.target.value)
                                               }}
                                               onClick={(e) => {
                                                   e.stopPropagation()
                                               }}
                                        />
                                    </span>
                                    <button type="button"
                                            className='col-2 icon-button'
                                            onClick={() => {
                                                closeSearch(file)
                                            }}
                                    >
                                        <FontAwesomeIcon
                                            title="删除"
                                            icon={faTimes}
                                            size="lg"
                                        />
                                    </button>
                                </div>
                        }
                    </li>
                })
            }
        </ul>
    )
}

FileList.propTypes = {
    files: PropTypes.array,
    onFileClick: PropTypes.func,
    onFileDelete: PropTypes.func,
    onSaveEdit: PropTypes.func
}

export default FileList