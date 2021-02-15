import React from "react";
import PropTypes from 'prop-types';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faTimes} from "@fortawesome/free-solid-svg-icons";
import classNames from 'classnames';
import './TabList.scss'

const TabList = ({files, activeId, unSaveIds, onTabClick, onCloseTab}) => {
    return (
        <ul className='nav nav-pills tabList-component'>
            {files.map(file => {
                const withUnsavedMark=unSaveIds.includes(file.id)
                const finalClassNames = classNames({
                    'nav-link': true,
                    'active': file.id === activeId,
                    'withUnsaved':withUnsavedMark
                })
                return <li className='nav-item' key={file.id}>
                    <a href="#"
                       className={finalClassNames}
                       onClick={(e) => {
                           e.preventDefault();
                           onTabClick(file.id)
                       }}
                    >
                        {file.title}
                        <span className='close-icon ml-2'
                              onClick={(e) => {
                                  e.stopPropagation()
                                  onCloseTab(file.id)
                              }}
                        >
                            <FontAwesomeIcon icon={faTimes}/>
                        </span>
                        {withUnsavedMark? <span className="rounded-circle unsaved-icon ml-2"/>:''}
                    </a>
                </li>
            })}
        </ul>
    )
}
TabList.propTypes = {
    files: PropTypes.array,
    activeId: PropTypes.string,
    unSaveIds: PropTypes.array,
    onTabClick: PropTypes.func,
    onCloseTab: PropTypes.func
}
TabList.defaultProps = {
    unSaveIds: []
}
export default TabList