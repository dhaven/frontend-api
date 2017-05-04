const electron = require('electron')
const Conf = require('conf')
const config = new Conf()
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')
const fs = require('fs')
const Pool = require('threads').Pool;

const {ipcMain} = require('electron')
const {net} = require('electron')

var events = require('events');
var eventEmitter = new events.EventEmitter();
var Jimp = require("jimp");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Create the browser window.
  var bgColor = ('Wheit' == config.get('theme')) ? '#ffffff' : '#1e1e1e'
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: bgColor
  })
  mainWindow.setMenu(null);

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'app/index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
   mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.on('call', (event, arg) => {
  const request = net.request('https://1razj50pr8.execute-api.eu-west-1.amazonaws.com/stage1/list')
  request.setHeader("Auth",arg.tkn);
  request.setHeader("username",arg.usr);
  request.on('response', (response) => {
    //event.sender.send('res',`STATUS ${response.statusCode}`)
    //event.sender.send('res',`HEADERS: ${JSON.stringify(response.headers)}`)
    response.on('data', (chunk) => {
      event.sender.send('res',`${chunk}`)
    })
    response.on('end', () => {
      //event.sender.send('res','No more data in response.')
    })
  })
  request.end()
})

stitch_image = function(arg){
  if(arg.arr_imgs.length == arg.num_images){
    im1 = arg.arr_imgs[0];
    im2 = arg.arr_imgs[1];
    max_x = 0;
    max_y = 0;
    for(var i = 0; i < arg.pos.length; i++){
      curr = arg.pos[i].split(",");
      if(curr[0] > max_x){
        max_x = curr[0];
      }
      if(curr[1] > max_y){
        max_y = curr[1];
      }
    }
    out_width = max_x*im1.bitmap.width;
    out_height = max_y*im1.bitmap.height;
    var image = new Jimp(out_width,out_height);
    for(var j = 0; j < arg.pos.length; j++){
      offset_x = Number(arg.pos[j].split(",")[0])-1;
      offset_y = Number(arg.pos[j].split(",")[1])-1;

      image.blit(arg.arr_imgs[j], offset_x*im1.bitmap.width,offset_y*im1.bitmap.height,0,0,im1.bitmap.width,im1.bitmap.height );
    }

    image.write(arg.loc);
  }else{
    console.log("wait for more images");
  }
}


ipcMain.on('dwnld',(event,arg) =>{
  var i;
  arr = arg.location.split("/");
  image = arr[arr.length-1];
  requests = [];
  images = [];
  posArr = []
  eventEmitter.on('update_array',stitch_image);
  for(i = 1; i <= arg.num; i++){
    var request = net.request('https://1razj50pr8.execute-api.eu-west-1.amazonaws.com/stage1/download/' + arg.usr + "/" + image + "/" + i );
    request.setHeader("Auth",arg.tkn);
    request.on('response',(response) => {
      event.sender.send('dwnld',`STATUS ${response.statusCode}`)
      event.sender.send('dwnld',`HEADERS: ${JSON.stringify(response.headers)}`)
      var buffer = new Buffer("");
      response.on('data', (chunk) => {
        buffer = Buffer.concat([buffer,new Buffer(`${chunk}`)])
        console.log(`${chunk}`);
      })
      response.on('end', () => {
        image_data = JSON.parse(buffer).base64Image;
        console.log(image_data);
        pos = JSON.parse(buffer).pos;
        loc_split = arg.location.split(".");
        new_loc = loc_split[0] + pos + "." + loc_split[1];
        Jimp.read(Buffer.from(image_data, 'base64'), function (err, image) {
            // do stuff with the image (if no exception)
            images.push(image);
            posArr.push(pos);
            eventEmitter.emit('update_array',{'arr_imgs':images, 'num_images':arg.num,'pos':posArr, 'loc':arg.location});
        });
      })
    })
    request.end();
    requests.push(request)
  }
})
