const http = require('http');

function fetch(url){
  return new Promise((res,rej)=>{
    http.get(url,(r)=>{
      let data='';
      r.on('data',c=>data+=c);
      r.on('end',()=>res({status:r.statusCode,headers:r.headers,body:data}));
    }).on('error',rej);
  });
}

(async ()=>{
  try{
    const base = 'http://localhost:3001';
    console.log('GET /api/content/book-pages?book=intro&page=0&pageSize=500');
    const a = await fetch(base + '/api/content/book-pages?book=' + encodeURIComponent('intro') + '&page=0&pageSize=500');
    console.log(a.status);
    console.log(a.body.slice(0,2000));

    const sections = [
      'Философские принципы и концепты',
      'Описываем философскую основу модели'
    ];
    for(const s of sections){
      const url = base + '/api/content/chapters?book=' + encodeURIComponent('intro') + '&section=' + encodeURIComponent(s);
      console.log('\nGET ' + url);
      const r = await fetch(url);
      console.log(r.status);
      console.log(r.body.slice(0,2000));
    }
  }catch(err){
    console.error(err);
    process.exit(1);
  }
})();
