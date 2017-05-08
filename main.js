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
var request = require('request');
require('request-debug')(request);
var https = require('https')

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

ipcMain.on('refresh', (event, arg) => {
  const request = net.request('https://1razj50pr8.execute-api.eu-west-1.amazonaws.com/stage1/list')
  request.setHeader("Auth",arg.tkn);
  request.setHeader("username",arg.usr);
  request.on('response', (response) => {
    //event.sender.send('res',`STATUS ${response.statusCode}`)
    //event.sender.send('res',`HEADERS: ${JSON.stringify(response.headers)}`)
    response.on('data', (chunk) => {
      event.sender.send('refresh',`${chunk}`)
    })
    response.on('end', () => {
      //event.sender.send('res','No more data in response.')
    })
  })
  request.end()
})

split_image = function(filename, numTiles, username, token){
  Jimp.read(filename, function (err, image) {
    if (err) throw err;
    im_w = image.bitmap.width;
    im_h = image.bitmap.height;

    num_columns = Math.ceil(Math.sqrt(numTiles)); //number of tiles horizontally
    num_rows = Math.ceil(numTiles/num_columns); //number of tiles vertically

    tile_w = Math.floor(im_w/num_columns);
    tile_h = Math.floor(im_h/num_rows);

    var pos_y;
    var pos_x;
    var number = 1;
    for(pos_y = 0; pos_y < im_h-num_rows; pos_y += tile_h){
      for(pos_x = 0; pos_x < im_w-num_columns; pos_x += tile_w){
        new_image = image.clone();
        new_image.crop(pos_x, pos_y, tile_w,tile_h);
        index_x = Math.floor(pos_x / tile_w) + 1;
        index_y = Math.floor(pos_y / tile_h) + 1;

        path_array =filename.split("/");
        image_name = path_array[path_array.length-1];

        new_file = image_name.split(".")[0] + index_x + "_" + index_y + "_" + number + "." + image_name.split(".")[1];
        send_image(username,new_file,new_image, token)
        number += 1;
      }
    }
  });
}

send_image = function(username, filename, image_data, token){
  image_data.getBase64(Jimp.MIME_PNG, function(err, result){
    console.log("err" + err);
    //console.log("base64 image: " + result);
    my_image = result.replace("data:image/png;base64,","");
    options = {
      hostname: '1razj50pr8.execute-api.eu-west-1.amazonaws.com',
      port: 443,
      path: '/stage1/upload/' + username + '/' + filename,
      method: 'POST',
      //your options which have to include the two headers
      headers : {
        'Auth' : token,
        'Content-Type': 'image/png',
        'Content-Length': Buffer.byteLength(my_image)
      }
    };
    var postreq = https.request(options, function (res) {
      //Handle the response
    });
    postreq.write(my_image);
    postreq.end();
  });
}

ipcMain.on('upload',(event,arg) => {
  console.log(arg.file[0]);
  split_image(arg.file[0],5,arg.usr,arg.tkn);
})

stitch_image = function(arg){
  if(arg.arr_imgs.length == arg.num_images){
    //im1 = arg.arr_imgs[0];
    //im2 = arg.arr_imgs[1];
    max_x = 0;
    max_y = 0;
    for(var i = 0; i < arg.arr_imgs.length; i++){
      curr = arg.arr_imgs[i][0].split(",");
      if(Number(curr[0]) > max_x){
        max_x = Number(curr[0]);
      }
      if(Number(curr[1]) > max_y){
        max_y = Number(curr[1]);
      }
    }
    out_width = max_x*arg.arr_imgs[0][1].bitmap.width;
    out_height = max_y*arg.arr_imgs[0][1].bitmap.height;
    var image = new Jimp(out_width,out_height);
    for(var j = 0; j < arg.arr_imgs.length; j++){
      current_image = arg.arr_imgs[j][1]
      offset_x = Number(arg.arr_imgs[j][0].split(",")[0])-1;
      offset_y = Number(arg.arr_imgs[j][0].split(",")[1])-1;

      image.blit(current_image, offset_x*current_image.bitmap.width,offset_y*current_image.bitmap.height,0,0,current_image.bitmap.width,current_image.bitmap.height );
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
  images = []; //put images in dictionary instead where index is image position
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
        //console.log(`${chunk}`);
      })
      response.on('end', () => {
        image_data = JSON.parse(buffer).base64Image;
        pos = JSON.parse(buffer).pos;
        console.log(pos);
        read_image(images,image_data,pos,arg);
      })
    })
    request.end();
    requests.push(request)
  }
})

read_image = function(images,image_data,pos,arg){
  Jimp.read(Buffer.from(image_data, 'base64'), function (err, image) {
      // do stuff with the image (if no exception)
      images.push([pos,image])
      console.log(images)
      eventEmitter.emit('update_array',{'arr_imgs':images, 'num_images':arg.num, 'loc':arg.location});
  });
}
