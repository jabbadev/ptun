
var assert = require("assert"),
	should = require('should'),
	Chunker = require('../lib/chunker'),
	HttpDownloader = require('../lib/httpdownloader'),
	fs = require('fs'),
	http = require('http'),
	URL = require('url'),
	crypto = require('crypto');

describe('Chunker',function(){
	describe('#next()',function(){
		it('should return the next chunk [ start, end ]',function(){
			var ck = new Chunker(3011,1000);
			[0,999].should.eql(ck.next());
			[1000,1999].should.eql(ck.next());
			[2000,2999].should.eql(ck.next());
			[3000,3011].should.eql(ck.next());
			(function(){ck.next()}).should.throw('No more chunks');
		});
	});
	describe('#cn()',function(){
		it('should return actual chunk number',function(){
			var ck = new Chunker(3011,1000);
			(0).should.eql(ck.cn());
			(0).should.eql(ck.cn());
			ck.next();
			ck.next();
			(2).should.eql(ck.cn());
			
		});
	});
	describe('#chunks()',function(){
		it('should return number of chunks',function(){
			var ck = new Chunker(3011,1000);
			(4).should.eql(ck.chunks());
			var ck = new Chunker(3000,1000);
			(3).should.eql(ck.chunks());
		});
	});
	describe('#forEach(callBack)',function(){
		it('should exec callBack on every chunk',function(){
			var ck = new Chunker(3011,1000),
				chunks = [[3000,3011],[2000,2999],[1000,1999],[0,999]];
			ck.forEach(function(chunk){
				var ac = chunks.pop();
				ac.should.eql(chunk);
			});
		});
	});
});

describe('HttpDownloader',function(){

	before(function(done){
		var cipher = crypto.createCipher('aes-256-cbc',"secret1234");
		
		var f = fs.createWriteStream('test/resweb.txt');
		f.on('open',function(){
			['a','b','c','d','e','f','g','h','i','l'].forEach(function(letter,i){
				f.write(new Array(1024*1024).join(letter),function(){
					if ( letter == 'l' ) {
						f.end();
					}
				});
			});
		});
		f.on('finish',function(){
			http.createServer(function (req,res) {
				if ( req.url == "/cipher" ) {
					var secret = new Buffer("This is a secret message");
					var secBuff = new Buffer(secret.toString("base64"),"base64");
					res.write(cipher.update(secBuff));
					res.end(cipher.final());
				
				} else if ( req.url == "/chunk" ) {
					
					var start = (req.headers.range.split("-"))[0];
					var end = (req.headers.range.split("-"))[1];
					var offset = end - start ;
					console.log(start,end,offset);
					var data = new Buffer(offset);
					var fd = fs.openSync('test/resweb.txt','r');
					fs.readSync(fd,data,start,offset-1);
					fs.closeSync(fd);
					console.log('data: ',data);
					res.end(data);
					
				} else {
					res.writeHead(200,{'Content-Type': 'text/plain'});
					var st = fs.createReadStream('test/resweb.txt');
					st.on('data',function(data){res.write(data);});
					st.on('end',function(){
						res.end();
					});
				}
			}).listen(8080,'127.0.0.1',function(){
				done();
				//console.log('Server running at http://127.0.0.1:8080/'); 
			});
		});
	});
	
	after(function(){
		fs.unlinkSync('test/resweb.txt');
	});
	
	describe('#start()',function(){
		it('start http docwnload',function(done){
			var bytes = 0;
			var hd = new HttpDownloader({ reqOpt: URL.parse('http://127.0.0.1:8080/') });
			
			hd.on('data',function(data){
				bytes = bytes + data.length;
			});
		
			hd.on('end',function(){
				bytes.should.eql(10485750);
				done();
			});
			
			hd.start();
		});
		
		describe('#cipher download',function(){
			it('cipher download',function(done){
				var secMsg = "";
				var hd = new HttpDownloader({ reqOpt: URL.parse('http://127.0.0.1:8080/cipher'),
										  ptun: { "server": "http://127.0.0.1:8080/", secretkey: "secret1234","algorithm": "aes-256-cbc" }});
			
				hd.on('data',function(data){
					secMsg = secMsg + data.toString();
				});
		
				hd.on('end',function(data){
					if(data != null){
						secMsg = secMsg + data.toString();
					}
					secMsg.should.eql("This is a secret message");
					done();
				});
			
				hd.start();
			});
		});
		
		describe('#chunk download',function(){
			it('chunk download',function(done){
				var secMsg = "";
				var hd = new HttpDownloader({ reqOpt: URL.parse('http://127.0.0.1:8080/chunk'),
										  chunk: { start: (1024*1024)-2, end: (1024*1024)+2 } });
			
				hd.on('data',function(data){
					secMsg = secMsg + data.toString();
				});
		
				hd.on('end',function(data){
					if(data != null){
						secMsg = secMsg + data.toString();
					}
					secMsg.should.eql("This is a secret message");
					done();
				});
			
				hd.start();
			});
		});
		
	});
});
