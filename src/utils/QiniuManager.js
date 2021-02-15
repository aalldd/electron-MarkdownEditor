const qiniu=require('qiniu')
const axios=require('axios')
const fs=require('fs')
class QiniuManager{
    constructor(accessKey,secretKey,bucket) {
        //generate mac
        this.mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        this.bucket=bucket
        //init config class
        this.config = new qiniu.conf.Config();
        // 空间对应的机房
        this.config.zone =qiniu.zone.Zone_z0;
        this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
    }

    uploadFile(key,localFilePath){
        const options = {
            scope: this.bucket + ":" + key,
        };
        const putPolicy = new qiniu.rs.PutPolicy(options);
        const uploadToken=putPolicy.uploadToken(this.mac);
        const formUploader = new qiniu.form_up.FormUploader(this.config);
        const putExtra = new qiniu.form_up.PutExtra();
        return new Promise((resolve,reject)=>{
            // 文件上传
            formUploader.putFile(uploadToken, key, localFilePath, putExtra, this._handleCallBack(resolve,reject));
        })
    }
    renameFile(oldKey,newKey){
        const options={
            force: true
        }
        return new Promise((resolve,reject)=>{
            this.bucketManager.move(this.bucket,oldKey,this.bucket,newKey,options,this._handleCallBack(resolve,reject))
        })
    }

    deleteFile(key){
        return new Promise((resolve, reject)=>{
            this.bucketManager.delete(this.bucket,key,this._handleCallBack(resolve,reject))
        })
    }
    getBucketDomin(){
        const reqURL=`http://api.qiniu.com/v6/domain/list?tbl=${this.bucket}`
        const digest=qiniu.util.generateAccessToken(this.mac,reqURL)
        return new Promise((resolve,reject)=>{
            qiniu.rpc.postWithoutForm(reqURL,digest,this._handleCallBack(resolve,reject))
        })
    }
    generateDownLoadLink(key){
        const domainPromise=this.publicBucketDomain?
            Promise.resolve(this.publicBucketDomain):this.getBucketDomin()
        return domainPromise.then(data=>{
            if(Array.isArray(data)&& data.length>0){
                const pattern=/^https?/
                this.publicBucketDomain=pattern.test(data[0])?data[0]:`http://${data[0]}`
                return this.bucketManager.publicDownloadUrl(this.publicBucketDomain,key)
            }else {
                throw Error('域名未找到，请查看存储空间是否已经过期')
            }
        })
    }
    downloadFile(key,downloadPath){
    //    get the downloadlink
    //    step2 send the request to download link return a readable stream
    //    step3 create a writable stream and pipe to it
    //    step4 return a promise based result
        return  this.generateDownLoadLink(key).then(link=>{
            const timeStamp=new Date().getTime()
            const url=`${link}?timestamp=${timeStamp}`
            return  axios({
                url,
                method:'GET',
                responseType:'stream',
                headers:{'Cache-Control':'no-cache'}
            })
        }).then(response=>{
            const writer=fs.createWriteStream(downloadPath)
            response.data.pipe(writer)
            return new Promise((resolve, reject) => {
                writer.on('finish',resolve)
                writer.on('error',reject)
            })
        }).catch(error=>{
            return Promise.reject({err:error.response})
        })
    }

    getStat(key){
        return new Promise((resolve, reject) =>{
            this.bucketManager.stat(this.bucket,key,this._handleCallBack(resolve,reject))
        } )
    }

    getFileList(){
        return new Promise((resolve,reject)=>{
            this.bucketManager.listPrefix(this.bucket,{},this._handleCallBack(resolve,reject))
        })
    }

    // 高阶函数
    _handleCallBack(resolve,reject){
        return (respErr, respBody, respInfo)=>{
            if (respErr) {
                throw respErr
            }
            if (respInfo.statusCode == 200) {
                resolve(respBody)
            } else {
                reject({
                    statusCode:respInfo.statusCode,
                    body:respBody
                })
            }
        }
    }
}
module.exports=QiniuManager