var express = require('express');
var app = express();
var dev = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
const translate = require('google-translate-api');
var fs = require("fs");
var ip = "";
users = [];
var geolocation = [{name:"", lat:"", lng:""}];
banip = [];
ips = [];
password = [];
socketsid = [];
vips = []; //admins skills can see all messages and mute some persons comand: /^ user
mute = []; // list of persons can not talk
mute.push("undefined");
connections =[];
server.listen(process.env.PORT || 3000);
console.log('Server Chat running...');
console.log("127.0.0.1:3000");
app.get('/',function(req,res){
	res.sendFile(__dirname + '/index.html')
});
dev.get('/',function(req,res){
	res.sendFile(__dirname + '/Dev.html')
});
app.use('/dev', dev);
var contents = fs.readFileSync("./files/config.json");
var config = JSON.parse(contents);
var cont = 0;
var server = [{room: "convivio", users:[]}];
server.push({room:"room2",users:[]});
io.sockets.on('connection',function(socket){
	cont++;
	connections.push(socket);

	socket.room ="";
	ip = socket.conn.remoteAddress;
	console.log('Nova Conexão pelo IP: %s, Total de sockets conectados: %s',ip,connections.length);
	// Disconnect
	socket.on('disconnect',function(data,user){
		try{
			if(socket.room != ""){
				socket.leave(socket.room);
			}
			if(socket.username.length > 0){
				for(var i = 0; i < server.length; i++){
					for(var j = 0; j < server[i].users.length; j++){
						if(server[i].users[j] == socket.username){
							server[i].users.splice(server[i].users.indexOf(socket.username),1);
						}
					}
				}
				users.splice(users.indexOf(socket.username),1);
				socketsid.splice(socketsid.indexOf(socket.id),1);
				connections.splice(connections.indexOf(socket),1);
				updateUsernames(socket.room);
				console.log('%s Desconectou-se, Total de sockets  conectados : %s',socket.username, connections.length);
			}
		}catch(error){
			socketsid.splice(socketsid.indexOf(socket.id),1);
			connections.splice(connections.indexOf(socket),1);
			console.log('Anonymous Desconectou-se, Total de sockets  conectados : %s', connections.length);
		}
	
		
	});
	socket.on('ReciveLocation',function(user,pos){
		console.log("New location add for user:" +  user);
		var canAdd = true;
		for(var i = 0; i < geolocation.length; i++){
			if(user == geolocation[i].name){
				geolocation[i].lat = pos.lat;
				geolocation[i].lng =  pos.lng;
				canAdd = false;
			}
		}
		if(canAdd == true){
			geolocation.push({name: user, lat: pos.lat, lng: pos.lng});
		}
	});
	socket.on('SendLocation',function(user,pos){
		console.log(user + " location was request");
		console.log(geolocation);
		for(var i = 0; i < geolocation.length; i++){
			if(user == geolocation[i].name){
				socket.emit('getLocation',geolocation[i].lat,geolocation[i].lng);
			}
		}
	});

	socket.on('StreamVideo',function(StreamVideo,user){
		console.log(StreamVideo);
		io.sockets.in(socket.room).emit('SendVideoStream',StreamVideo,user);
	});
	socket.on('game',function(){
		socket.emit('playgame');
	});
	socket.on('translate', function(message,language){
		if(!language){
			language = 'pt'
		}
		translate(message, {to: language}).then(res => {
		    console.log(res.text);
		    socket.emit('translateResponse',res);
		    //=> I speak English
		    console.log(res.from.language.iso);
		    //=> nl
		}).catch(err => {
		    console.error(err);
		});
	});
	socket.on('translateMessage', function(data, receiver,users,language){
		if(!language){
			language = 'pt'
		}
		if(language == 'pt-PT'){
			language = 'pt';
		}
		translate(data.msg, {to: (language)}).then(res => {
		    console.log(res.text);
		    data.msg = res.text
		    socket.emit('translateResponse',data, receiver,users);
		    //=> I speak English
		    console.log(res.from.language.iso);
		    //=> nl
		}).catch(err => {
		    console.error(err);
		});
	});
	socket.on('translateLabels', function(Label,item,language){
		if(!language){
			language = 'pt'
		}
		translate(Label, {to: language}).then(res => {
		    socket.emit("LabelsTranslated",res.text,item);
		}).catch(err => {
		    console.error(err);
		});
	});
	// Send Message
	socket.on('send message',function(data,receiver){
		var index = [];
		var count = 0;
		var canTalk = false;
		var error = true;
		for(var i=0;i < users.length;i++){
			if(receiver == users[i] || vips[i] == users[i]){
				index[count] = i;
				count++;
			}
			if(socket.username == users[i]){
				canTalk = true;
			}
		}
		
		if (receiver != ""){
			for(var i =0; i < mute.length;i++){
				if(socket.username == mute[i]){
					canTalk = false;
				}
			}

			for(var i =0; i < users.length;i++){
				if(receiver == users[i]){
					error = false;
				}
			}
			try{
			if (canTalk == true && error == false){


			
				for(var i =0; i < index.length; i++){
				socket.broadcast.to(socketsid[index[i]]).emit('new message', {msg: data, user: socket.username},receiver,users);
				}
				socket.emit('new message', {msg: data, user: socket.username},receiver,users,vips);	
			 }else if (canTalk == false){
				socket.emit('new message', {msg: "Você foi silenciado pelo Administrador!", user: socket.username},receiver,users,vips);
				}else if(error == true){
					socket.emit('new message', {msg: "Este Utilizador não está ativo de momento, por favor tente mais tarde", user: socket.username},receiver,users,vips);
				}

			}catch(error){
				console.log(error);
			}
			
		}else{

			for(var i =0; i < mute.length;i++){
				if(socket.username == mute[i]){
					canTalk = false;
				}
			}
		
			if(canTalk == true ){
				io.sockets.in(socket.room).emit('new message', {msg: data, user: socket.username},receiver,users);
			}else if(canTalk == false){
				socket.emit('new message', {msg: "Você foi silenciado pelo Administrador!", user: socket.username},receiver,users,vips);
			}
			
			
		}
		
	});

	// User ban -  not working

	socket.on('ban',function(receiver){

		/*for(var i = 0; i < config.DB.Users.length; i++){
			if(receiver == config.DB.Users[i].name){
				
			}
		}*/
	
	});

	//Prepare Users to restart server
	socket.on('restart', function(){
		users = [];
		config.DB.Users = [];
		password = [];
		socketsid = [];
		vips = []; 
		mute = [];
		connections =[];
		io.sockets.in(socket.room).emit('restart complete');
	});

	socket.on('writing', function(user){
		io.sockets.in('convivio').emit('user RealWrite',user);
	});

	socket.on('createroom',function(room){
		var cancreate= true;
		for(var i = 0; i < server.length;i++){
			if(server[i].room == room ||room.length < 3 || room.length > 20){
				cancreate = false;
			}
		}
		if(cancreate == true){
			server.push({room:room,users:[]});
			io.sockets.emit('get rooms',server);
			console.log(room + " foi cridada");
		}else{
			socket.emit('errorCreateRoom',room);
		}
	});
	socket.on('changeroom',function(room){
		socket.leave(socket.room);
			for(var i = 0; i < server.length; i++){
				for(var j = 0; j < server[i].users.length; j++){
					if(server[i].users[j] == socket.username){
						server[i].users.splice(server[i].users.indexOf(socket.username),1);
					}
				}
			}
			updateUsernames(socket.room);
			for(var x = 0; x < server.length; x++){
				if(server[x].room == room){
					server[x].users.push(socket.username);
				}
			}
		socket.room = room;
		socket.join(socket.room);
		io.sockets.emit('get rooms',server);
		updateUsernames(socket.room);

	});

	//Get info
	socket.on('info',function(Nickname){
		for(var i = 0; i < config.DB.Users.length; i++){
			if(Nickname == config.DB.Users[i].name){
				socket.emit('infoUser',config.DB.Users[i].nomecompleto,config.DB.Users[i].typephoto,config.DB.Users[i].b64photo);
			}
		}
		
		
	});
	socket.on('translationRequestEmit',function(Nickname){
		for(var i = 0; i < config.DB.Users.length; i++){
			if(Nickname == config.DB.Users[i].name){
				if(config.DB.Users[i].translate == null){
					config.DB.Users[i].translate = false;
				}
				config.DB.Users[i].translate = !config.DB.Users[i].translate;
			}
		}
	});


	//User priv
	socket.on('priv',function(receiver){
		console.log(receiver + " tornou-se VIP");
		for(var i = 0; i < config.DB.Users.length; i++){
			if(receiver == config.DB.Users[i].name){
				config.DB.Users[i].vip = true;
				vips.push(receiver);
				socket.emit('IsModTrue');
			}
		}
		socket.emit('new vip',receiver);
		contents = JSON.stringify(config);
		fs.writeFileSync("./files/config.json", contents);
	});

	socket.on('IsMod',function(receiver){
		for(var i = 0; i < config.DB.Users.length; i++){
			if(receiver == config.DB.Users[i].name){
				if(config.DB.Users[i].vip == true){
					vips.push(receiver);
					socket.emit('IsModTrue');
				}
			}
		}

	});

	//mute user
	socket.on('mute',function(receiver){

		var premission = false;
		for(var i = 0; i < vips.length;i++){
			if(socket.username == vips[i]){
				premission = true;
				
			}
		}
		if (premission ==true) {
			var canMute = true;
			for(var i =0; i < mute.length; i++){
				if(receiver == mute[i]){
					canMute = false;
				}
			}
			if (canMute == false){
				mute.splice(mute.indexOf(receiver),1);
				io.sockets.emit('remove mute',receiver);
			}else{
			console.log(receiver);
			mute.push(receiver);
			io.sockets.emit('new mute',receiver);
			}
				
		}
		
	});
	//New User

	socket.on('new user',function(data,data1,nome,callback){
		var exist = false;
		var banned = false;
		data = data.replace(/\s+/g, '');
		data1 = data1.replace(/\s+/g, '');
		for(var i = 0; i < config.DB.Users.length;i++){
			if(data == config.DB.Users[i].name){
				exist = true;
			}
		}
		if(banip.length > 0){
			for(var i = 0; i < banip.length; i++){
				if(ip == banip[i]){
					banned = true;
				}
			}
		}
		if (exist == true || data == "" || data == null  || data.length < 3 || data.length > 15){
			callback(false);
			socket.emit('error sign');
		}else{

			if(banned == true){
				socket.emit('banned');
			}else if (data1.length < 7){
				socket.emit('lowpassword');
			}else{


			 data = data.replace(/\s+/g, '');
		
			callback(true);
			socket.username = data;
			users.push(socket.username);
			server[0].users.push(socket.username);
			ips.push(ip);
			socket.room= "convivio";
			socket.join('convivio');
			config.DB.Users.push({
				nomecompleto: nome,
				name: data,
				pw: cripto(data1,"sign"),
				dateofcreate: GetTodayDate(),
				listfollow: [],
				listblock:[],
				typephoto: "",
				vip: false,
				b64photo: "",
			});
			contents = JSON.stringify(config);
			fs.writeFileSync("./files/config.json", contents);
			socketsid.push(socket.id)
			updateUsernames(socket.room);
			io.sockets.emit('get rooms',server);	
			}
		}
		
	});
		function GetTodayDate() {
			var currentdate = new Date(); 
			var datetime = currentdate.getDate() + "/"
                + (currentdate.getMonth()+1)  + "/" 
                + currentdate.getFullYear();
                return datetime;
		}
		//criptografica unica e exclusiva
		function cripto(password,type,logic){
			var logical = "";
			if(type == "login"){
				logical = logic;
			}else if (type == "sign"){
				logical = GetTodayDate();
			}
			var cripto = "";
			for(var i = 0; i < password.length; i++){
				if(password.length % 2 == 0){
					logical+= logical[i] + password[i - 1];
				}else{
				logical+= logical[i] + "$%#!@";
				}
				if(password[i] == "A"){
					cripto+= logical + "@#z";
				}else if(password[i] == "B"){
					cripto+= logical + "@#x";
				}else if(password[i] == "C"){
					cripto+= logical +  "@#c";
				}else if(password[i] == "D"){
					cripto+= logical +  "@#v";
				}else if(password[i] == "E"){
					cripto+= logical +  "@#b";
				}else if(password[i] == "F"){
					cripto+= logical +  "@#n";
				}else if(password[i] == "G"){
					cripto+= logical +  "@#m";
				}else if(password[i] == "H"){
					cripto+= logical +  "@#a";
				}else if(password[i] == "I"){
					cripto+= logical +  "@#s";
				}else if(password[i] == "J"){
					cripto+= logical +  "@#d";
				}else if(password[i] == "K"){
					cripto+= logical +  "@#f";
				}else if(password[i] == "L"){
					cripto+= logical +  "@#g";
				}else if(password[i] == "M"){
					cripto+= logical +  "@#h";
				}else if(password[i] == "N"){
					cripto+= logical +  "@#j";
				}else if(password[i] == "O"){
					cripto+= logical +  "@#k";
				}else if(password[i] == "P"){
					cripto+= logical +  "@#l";
				}else if(password[i] == "Q"){
					cripto+= logical +  "@#q";
				}else if(password[i] == "R"){
					cripto+= logical +  "@#w";
				}else if(password[i] == "S"){
					cripto+= logical +  "@#e";
				}else if(password[i] == "T"){
					cripto+= logical +  "@#r";
				}else if(password[i] == "U"){
					cripto+= logical +  "@#t";
				}else if(password[i] == "V"){
					cripto+= logical +  "@#y";
				}else if(password[i] == "W"){
					cripto+= logical +  "@#u";
				}else if(password[i] == "X"){
					cripto+= logical +  "@#i";
				}else if(password[i] == "Y"){
					cripto+= logical +  "@#o";
				}else if(password[i] == "Z"){
					cripto+= logical +  "@#p";
				}else if(password[i] == "a"){
					cripto+= logical +  "#z";
				}else if(password[i] == "b"){
					cripto+= logical +  "#x";
				}else if(password[i] == "c"){
					cripto+= logical +  "#c";
				}else if(password[i] == "d"){
					cripto+= logical +  "#v";
				}else if(password[i] == "e"){
					cripto+= logical +  "#b";
				}else if(password[i] == "f"){
					cripto+= logical +  "#n";
				}else if(password[i] == "g"){
					cripto+= logical +  "#m";
				}else if(password[i] == "h"){
					cripto+= logical +  "#a";
				}else if(password[i] == "i"){
					cripto+= logical +  "#s";
				}else if(password[i] == "j"){
					cripto+= logical +  "#d";
				}else if(password[i] == "k"){
					cripto+= logical +  "#f";
				}else if(password[i] == "l"){
					cripto+= logical +  "#g";
				}else if(password[i] == "m"){
					cripto+= logical +  "#h";
				}else if(password[i] == "n"){
					cripto+= logical +  "#j";
				}else if(password[i] == "o"){
					cripto+= logical +  "#k";
				}else if(password[i] == "p"){
					cripto+= logical +  "#l";
				}else if(password[i] == "q"){
					cripto+= logical +  "#q";
				}else if(password[i] == "r"){
					cripto+= logical +  "#w";
				}else if(password[i] == "s"){
					cripto+= logical +  "#e";
				}else if(password[i] == "t"){
					cripto+= logical +  "#r";
				}else if(password[i] == "u"){
					cripto+= logical +  "#t";
				}else if(password[i] == "v"){
					cripto+= logical +  "#y";
				}else if(password[i] == "w"){
					cripto+= logical +  "#u";
				}else if(password[i] == "x"){
					cripto+= logical +  "#i";
				}else if(password[i] == "y"){
					cripto+= logical +  "#o";
				}else if(password[i] == "z"){
					cripto+= logical +  "#p";
				}else if(password[i] == "1"){
					cripto+= logical +  "#][";
				}else if(password[i] == "2"){
					cripto+= logical + "#[[";
				}else if(password[i] == "3"){
					cripto+= logical + "#[]";
				}else if(password[i] == "4"){
					cripto+= logical + "#]]";
				}else if(password[i] == "5"){
					cripto+= logical + "]#[";
				}else if(password[i] == "6"){
					cripto+= logical + "[#]";
				}else if(password[i] == "7"){
					cripto+= logical + "[#[";
				}else if(password[i] == "8"){
					cripto+= logical + "[]#";
				}else if(password[i] == "9"){
					cripto+= logical + "[[#";
				}else{
					cripto+= password[i];
				}
			}
			return cripto;
		}

		socket.on('uploadPhoto',function(data,namephoto,datatype){
			//var imageBuffer = decodeBase64Image(data);
			//var image64 = b64EncodeUnicode(data);
			for(var i = 0; i < config.DB.Users.length;i++){
				if(namephoto == config.DB.Users[i].name){
					config.DB.Users[i].typephoto = datatype;
					config.DB.Users[i].b64photo = data;
					socket.emit('infoUser',config.DB.Users[i].nomecompleto,config.DB.Users[i].typephoto,config.DB.Users[i].b64photo);
				}
			}
			contents = JSON.stringify(config);
			fs.writeFileSync("./files/config.json", contents);
		/*	fs.writeFile("../Heroku iochat/files/" + namephoto + ".png", imageBuffer.data, 'binary', function(err){
            if (err) throw err
            console.log('File saved.');
        	});*/
		});

		socket.on('sendFileMessageTxt',function(data,namefile,user,type){
			//var imageBuffer = decodeBase64Image(data);
			/*fs.writeFile("../Heroku iochat/files/documents" + namefile, data,function(err){
            if (err) throw err
            console.log('File saved.');
        	});*/	
        	io.sockets.in(socket.room).emit('FileSendMessage',data,user,namefile,type);
		});

		socket.on('followUser',function(userfollow, utilizadorativo){
			var adicionar = false;
			var index = 0;
			for(var i = 0; i < config.DB.Users.length;i++){
				if(utilizadorativo == config.DB.Users[i].name){
					if(config.DB.Users[i].listfollow.length >=1){

						for(var x = 0; x < config.DB.Users[i].listfollow.length;x++){
							if(config.DB.Users[i].listfollow[x] == userfollow){
								adicionar = false;
								index = i;
							}else{
								adicionar = true;
								index = i;
							}
						}

					}else{
						adicionar = true;
						index = i;
					}
				}
				
			}

			if(adicionar == true){
				config.DB.Users[index].listfollow.push(userfollow);
				}else if (adicionar == false){
					try{
					config.DB.Users[index].listfollow.splice(config.DB.Users[index].listfollow.indexOf(userfollow),1);
					}catch(error){
						
					}
					
				}
			contents = JSON.stringify(config);
			fs.writeFileSync("./files/config.json", contents);
			socket.emit('UpdateListFollow',config.DB.Users[index].listfollow);
			
		});

		function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}
			socket.on('blockUser',function(userfollow, utilizadorativo){
			var adicionar = false;
			var index = 0;
			for(var i = 0; i < config.DB.Users.length;i++){
				if(utilizadorativo == config.DB.Users[i].name){
					if(config.DB.Users[i].listblock.length >=1){

						for(var x = 0; x < config.DB.Users[i].listblock.length;x++){
							if(config.DB.Users[i].listblock[x] == userfollow){
								adicionar = false;
								index = i;
							}else{
								adicionar = true;
								index = i;
							}
						}

					}else{
						adicionar = true;
						index = i;
					}
				}

			}

			if(adicionar == true){
				config.DB.Users[index].listblock.push(userfollow);
				}else if (adicionar == false){
					try{
					config.DB.Users[index].listblock.splice(config.DB.Users[index].listblock.indexOf(userfollow),1);
					}catch(error){
						
					}
					
				}
			contents = JSON.stringify(config);
			fs.writeFileSync("./files/config.json", contents);
			socket.emit('UpdateListblock',config.DB.Users[index].listblock);

			
		});


		
		function decodeBase64Image(dataString) {
		  var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
		    response = {};

		  if (matches.length !== 3) {
		    return new Error('Invalid input string');
		  }

		  response.type = matches[1];
		  response.data = new Buffer(matches[2], 'base64');

		  return response;
		}


		socket.on('new login',function(data,data1,callback){
		var exist = false;
		var on = false;
		var banned = false;
		data = data.replace(/\s+/g, '');
		data1 = data1.replace(/\s+/g, '');
		for(var i = 0; i < config.DB.Users.length;i++){
			if(data == config.DB.Users[i].name){
				if(config.DB.Users[i].pw == cripto(data1,"login",config.DB.Users[i].dateofcreate)){
					exist= true;
					socket.emit('UpdateListFollow',config.DB.Users[i].listfollow);
					socket.emit('UpdateListblock',config.DB.Users[i].listblock);
				}
			}
		}
		if(banip.length > 0){
			for(var i = 0; i < banip.length; i++){
				if(ip == banip[i]){
					socket.emit('banned');
					banned = true;
				}
			}
		}
		for (var i = 0; i < users.length;i++){
			if(data == users[i]){
				on = true;
			}
		}
		if (exist == false || data == " " || data == null || on == true || banned == true){
			callback(false);
			if(on == true){
			socket.emit('error login2');
			}else if (banned == true){
				socket.emit('banned');
			}else{
			socket.emit('error login');
			}
		}else{

		 socket.emit('true login');	
		 data = data.replace(/\s+/g, '');
	
		callback(true);
		socket.username = data;
		socket.room = "convivio";
		socket.join('convivio')
		users.push(socket.username);
		server[0].users.push(socket.username);
		ips.push(ip);
		socketsid.push(socket.id)
		updateUsernames(socket.room);
		io.sockets.emit('get rooms',server);	
		}
		
	});

	function updateUsernames(room){
		for(var i = 0; i < server.length; i++){
			if(server[i].room == room){
				io.sockets.in(room).emit('get users', server[i].users);
			}
		}
		//io.sockets.in(room).emit('get users', users);
	}

});