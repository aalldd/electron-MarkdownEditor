import {useState, useEffect} from "react";
const useKeyPress=(targetKeycode)=>{
    const [KeyPressed,setKeyPressed]=useState(false)
    const keyDownHandler=({keyCode})=>{
        if(keyCode===targetKeycode){
            setKeyPressed(true)
        }
    }
    const keyUpHandler=({keyCode})=>{
        if(keyCode===targetKeycode){
            setKeyPressed(false)
        }
    }

    useEffect(()=>{
        document.addEventListener('keydown',keyDownHandler)
        document.addEventListener('keyup',keyUpHandler)
        return (()=>{
            document.removeEventListener('keydown',keyDownHandler)
            document.removeEventListener('keyup',keyUpHandler)
        })
        // eslint-disable-next-line
    },[])
    return KeyPressed
}

export default useKeyPress