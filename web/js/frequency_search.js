window.frequencySearchOpen = (url, newTab) => {
  const target = new URL(url);
  if(target.protocol !== 'https:') throw new Error('搜索链接无效');
  if(newTab){ const anchor=document.createElement('a'); anchor.href=target.href;anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.click(); }
  else window.location.assign(target.href);
};
window.frequencySearchBackground = () => new Promise(resolve => {
  const input=document.createElement('input');input.type='file';input.accept='image/*';
  input.style.display='none';document.body.appendChild(input);
  input.oncancel=()=>{input.remove();resolve(JSON.stringify({cancelled:true}));};
  input.onchange=async()=>{
    let url,canvas;
    try{
      const file=input.files?.[0];if(!file){resolve(JSON.stringify({cancelled:true}));return;}
      if(file.size>32*1024*1024)throw new Error('背景图片不能超过 32 MB。');
      url=URL.createObjectURL(file);
      const image=await new Promise((ok,fail)=>{const img=new Image();const timer=setTimeout(()=>fail(new Error('图片解码超时。')),15000);img.onload=()=>{clearTimeout(timer);ok(img);};img.onerror=()=>{clearTimeout(timer);fail(new Error('图片损坏或不支持。'));};img.src=url;});
      if(image.naturalWidth*image.naturalHeight>16000000)throw new Error('背景图片不能超过 1600 万像素。');
      const scale=Math.min(1,1920/Math.max(image.naturalWidth,image.naturalHeight));
      canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
      const ctx=canvas.getContext('2d');ctx.fillStyle='#111315';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL('image/jpeg',0.82);
      if(data.length>2*1024*1024)throw new Error('压缩后背景仍超过 2 MB，请选择更小图片。');
      resolve(JSON.stringify({data,name:file.name}));
    }catch(error){resolve(JSON.stringify({error:error.message}));}
    finally{input.remove();if(url)URL.revokeObjectURL(url);if(canvas){canvas.width=0;canvas.height=0;}}
  };input.click();
});
