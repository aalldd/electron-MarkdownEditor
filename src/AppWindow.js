const {BrowserWindow}=require('electron')

class AppWindow extends BrowserWindow {
    constructor(config,urlLocation) {
        const basicConfig={
            width:800,
            height:600,
            webPreferences:{
                nodeIntegration:true,
                enableRemoteModule:true
            },
            show:false,
            bgColor:'#efefef'
        }
        const finalConfig={...basicConfig,...config}
        super(finalConfig)
        this.loadURL(urlLocation)
        this.once('ready-to-show',()=>{
            this.show()
        })
    }
}
module.exports=AppWindow