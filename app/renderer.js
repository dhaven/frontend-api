// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
$(function() {
  const {ipcRenderer} = require('electron');
  const {dialog} = require('electron').remote;
  var lock = new Auth0Lock('4BWjq8pLmL2ddyL7M9nl6DEunA71I75h', 'cloud-storage-ucl.eu.auth0.com', {
    auth: {
      responseType: 'id_token',
      params: {
        scope: 'openid email user_metadata'
      },
      sso: false,
      redirect: false
    }
  });

  var idToken = localStorage.getItem('id_token') || null;
  var username = localStorage.getItem('usr') || null;
  var list_images = localStorage.getItem('list_images') ||null;
  var profile = JSON.parse(localStorage.getItem('profile')) || null;
  if (idToken && profile) {
    $('.avatar').attr('src',profile.picture);
    $('.name').text(profile.nickname);
    $('.email').text(profile.email);
    $('.profile-section').show();
    $('#descr1').hide();
    $('#descr2').hide();
    $('#descr3').hide();
    $('#login').hide();
    $('#logout').show();
    $('#img-list').show();
    $('#bot-but').show();

  } else {
    $('.profile-section').hide();
    $('#login').show()
    $('#logout').hide();
  }
  $('#login').click(function(){
    lock.show();
  });

  lock.on('authenticated', (authResult) => {
        localStorage.setItem('id_token', authResult.idToken);
        idToken = authResult.idToken;
        //console.log(authResult);
        lock.getProfile(authResult.idToken, (err, profile) => {
          localStorage.setItem('profile', JSON.stringify(profile));
          //console.log(profile);
          localStorage.setItem('usr',profile.user_metadata.name);
          username = profile.user_metadata.name;
          $('.profile-section').show();
          $('.avatar').attr('src',profile.picture);
          $('.name').text(profile.nickname);
          $('.email').text(profile.email);
          $('#descr1').hide();
          $('#descr2').hide();
          $('#descr3').hide();
          $('#login').hide();
          $('#logout').show();
          $('#img-list').show();
          $('#bot-but').show();
        });
        lock.hide();
  });

  $('#logout').click(function() {
    localStorage.removeItem('profile');
    localStorage.removeItem('id_token');
    $('.profile-section').hide();
    $('.avatar').src = '';
    $('.name').text(null);
    $('.email').text(null);
    $('#descr1').show();
    $('#descr2').show();
    $('#descr3').show();
    $('#login').show();
    $('#logout').hide();
    $('#img-list').hide();
    $('#bot-but').hide();
  });

  $('#refresh').click(function(){
    console.log({'tkn':idToken,'usr':username});
    ipcRenderer.send('call',{'tkn':idToken,'usr':username});
  });

  $('#img-list').on('click','button',function(){
    id = $(this).attr('id');
    dialog.showSaveDialog({defaultPath:id},(result) =>{
      console.log(result);
      ipcRenderer.send('dwnld',{'usr':username,'location':result,'num':list_images[id],'tkn':idToken});
    });
  });

  ipcRenderer.on('dwnld',(event,arg) => {
    console.log(arg);
  });

  ipcRenderer.on('res', (event, arg) => {
    imgs = JSON.parse(arg);
    list_images = {};
    console.log(arg);
    $.each(imgs['testUser/'], function(key,value) {
      list_images[value[0]] = value[1];
      $('#img-list').append("<button type='button' class='list-group-item'" + " id=" + value[0] + ">" + value[0] + "</button>");
    });
  });
});
