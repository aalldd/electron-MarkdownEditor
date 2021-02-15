import React, {useState, useEffect, useRef} from "react";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faSearch, faTimes} from '@fortawesome/free-solid-svg-icons'
import styled from 'styled-components';
import PropTypes from 'prop-types';
import useKeyPress from "../hooks/useKeyPress";
import useIpcRenderer from "../hooks/useIpcRenderer";

const Wrapper = styled.div`
  width: 100%;
  height: 50px;
  font-size: 14px;
  background-color: lightblue;
  display: flex;
  align-items: center;
  padding: 0 20px;
  >div{
    width: 100%;
    display: flex;
    justify-content: space-between;
    >input{
      height: 30px;
      background-color: lightblue;
      outline: none;
    }
  }
`

const FileSearch = ({title, onFileSearch}) => {
    const [inputActive, setInputActive] = useState(false)
    const [value, setValue] = useState('')
    const node = useRef(null)
    const keyEnterPressed=useKeyPress(13)
    const keyEscPressed=useKeyPress(27)
    const closeSearch = () => {
        setInputActive(false)
        setValue('')
        onFileSearch('')
    }
    useEffect(() => {
        if(keyEnterPressed && inputActive){
            console.log('keyEnterPressed')
            onFileSearch(value)
        }else if(keyEscPressed && inputActive){
            closeSearch()
        }
    })
    useEffect(() => {
        if (inputActive) {
            node.current.focus()
        }
    }, [inputActive])

    const fileSearch=()=>{
        setInputActive(true)
    }
    useIpcRenderer({
        'search-file':fileSearch
    })
    return (
        <Wrapper>
            {!inputActive && <div>
                <span>{title}</span>
                <button type="button"
                        className="icon-button"
                        onClick={fileSearch}
                >
                    <FontAwesomeIcon
                        title="搜索"
                        icon={faSearch}
                        size="lg"
                    />
                </button>
            </div>}
            {
                inputActive &&
                <div>
                    <input type="text"
                           className="form-control col-8"
                           value={value}
                           ref={node}
                           onChange={(e) => {
                               setValue(e.target.value)
                           }}
                    />
                    <button type="button"
                            className="icon-button"
                            onClick={closeSearch}
                    >
                        <FontAwesomeIcon
                            title="关闭"
                            icon={faTimes}
                            size="lg"
                        />
                    </button>
                </div>
            }
        </Wrapper>
    )
}

FileSearch.propTypes={
    title:PropTypes.string,
    onFileSearch:PropTypes.func.isRequired
}

FileSearch.defaultProps={
    title:'我的云文档'
}

export default FileSearch