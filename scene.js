import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
export const COLORS=['#3366CC','#DC3912','#FF9900','#109618','#990099','#0099C6','#DD4477','#66AA00','#B82E2E','#316395','#994499','#22AA99','#AAAA11','#6633CC','#E67300','#8B0707','#329262','#5574A6','#3B3EAC','#B77322','#16A653','#B91383','#F26F98','#7A8B37','#0C7187'];
export function cargoColor(item){return COLORS[item.number-1]||`hsl(${(item.number*137.508)%360},62%,43%)`;}
export function cargoInk(item){
 const color=cargoColor(item);if(!color.startsWith('#'))return '#ffffff';
 const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>.179?'#000000':'#ffffff';
}
export class CargoScene{
 constructor(container,onPick){
  this.container=container;this.onPick=onPick;this.meshes=new Map();this.labels=new Map();this.view='iso';this.pendingCamera=null;this.needsRender=true;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));this.renderer.setClearColor(0x000000,0);
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
  container.replaceChildren(this.renderer.domElement);
  this.scene=new THREE.Scene();
  this.camera=new THREE.PerspectiveCamera(37,1,.1,100);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.maxPolarAngle=Math.PI/2-.025;this.controls.minDistance=2;this.controls.maxDistance=34;this.controls.enablePan=true;this.controls.screenSpacePanning=true;
  this.controls.addEventListener('change',()=>this.needsRender=true);this.controls.addEventListener('start',()=>this.pendingCamera=null);
  this.scene.add(new THREE.HemisphereLight(0xffffff,0xc2cbb4,1.8));
  const light=new THREE.DirectionalLight(0xfff8e9,2.3);light.position.set(3,13,7);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-13;light.shadow.camera.right=13;light.shadow.camera.top=13;light.shadow.camera.bottom=-13;light.shadow.normalBias=.035;light.shadow.bias=-.0001;this.scene.add(light);this.scene.add(light.target);
  this.fillLight=new THREE.DirectionalLight(0xe4edf3,1.5);this.fillLight.position.set(9,5,-8);this.scene.add(this.fillLight);
  this.content=new THREE.Group();this.scene.add(this.content);
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();let down;
  this.renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  this.renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<7)this.pick(e);down=null;});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();container.dispatchEvent(new CustomEvent('scene-lost',{bubbles:true}));});
  this.lastTime=0;this.animate=this.animate.bind(this);this.frame=requestAnimationFrame(this.animate);
 }
 clear(){this.content.traverse(o=>{o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)if(m){m.map?.dispose();m.dispose();}});this.content.clear();this.meshes.clear();this.labels.clear();}
 box(w,h,d,color,x,y,z,parent,opacity=1){const material=new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.03,transparent:opacity<1,opacity});const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 textSprite(text,{size=1,color='#4f6556',background=null}={}){
  const c=document.createElement('canvas');const ctx=c.getContext('2d');const font=background?'600 34px Arial':'500 28px Arial';ctx.font=font;const width=Math.ceil(ctx.measureText(text).width+32);c.width=width;c.height=58;ctx.font=font;
  if(background){ctx.fillStyle=background;ctx.beginPath();ctx.roundRect(0,0,width,58,10);ctx.fill();}
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,29);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:texture,depthWrite:false,depthTest:false,transparent:true,toneMapped:false});const s=new THREE.Sprite(material);s.scale.set(size*width/58,size,1);s.renderOrder=10;return s;
 }
 load(shipment){
  this.clear();this.shipment=shipment;const {length,width,height}=shipment.trailer;const L=length/1000,W=width/1000,H=height/1000;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.ShadowMaterial({opacity:.12}));ground.rotation.x=-Math.PI/2;ground.position.set(L/2,-.27,W/2);ground.receiveShadow=true;this.content.add(ground);
  const grid=new THREE.GridHelper(40,40,0xdbe3d5,0xe3e9dd);grid.position.set(L/2,-.28,W/2);grid.material.transparent=true;grid.material.opacity=.45;this.content.add(grid);
  this.box(L+.15,.13,W+.15,'#e0e5d8',L/2,-.09,W/2,this.content);
  this.box(L,.025,W,'#e9ede2',L/2,-.01,W/2,this.content);
  this.box(.11,.27,W+.15,'#9da99a',.015,-.2,W/2,this.content);
  this.box(.11,.27,W+.15,'#9da99a',L-.015,-.2,W/2,this.content);
  for(let x=0;x<L;x+=1.2){
   this.box(.012,.012,W,'#c3cfbb',x,.01,W/2,this.content);
   const row=this.textSprite(String(Math.round(x/1.2)+1),{size:.18,color:'#92a089'});row.position.set(x+.55,.035,W+.24);this.content.add(row);
  }
  for(const lane of [.8,1.6])this.box(L,.007,.008,'#d0d9c8',L/2,.012,W-lane,this.content);
  const frameGeom=new THREE.EdgesGeometry(new THREE.BoxGeometry(L,H,W));const frame=new THREE.LineSegments(frameGeom,new THREE.LineBasicMaterial({color:0xabbba7,transparent:true,opacity:.33}));frame.position.set(L/2,H/2,W/2);this.content.add(frame);
  const front=this.textSprite('FRONT',{size:.24,color:'#809779'});front.position.set(-.55,.06,W/2);this.content.add(front);
  const rear=this.textSprite('REAR DOORS',{size:.25,color:'#758f6b'});rear.position.set(L+.7,.06,W/2);this.content.add(rear);
  for(let i=0;i<3;i++){const label=this.textSprite(['L','C','R'][i],{size:.18,color:'#8a9e80'});label.position.set(L+.22,.05,W-(i*.8+.4));this.content.add(label);}
  const dimension=this.textSprite(`${(L).toFixed(1)} m`,{size:.25,color:'#9ba993'});dimension.position.set(L/2,-.08,-.56);this.content.add(dimension);
  this.highlight=this.box(1,.012,W,'#efc997',0,.028,W/2,this.content,.4);this.highlight.visible=false;
  for(const p of shipment.placements){
   const item=shipment.items.find(i=>i.id===p.id),group=new THREE.Group(),l=item.length/1000,w=item.width/1000,h=item.height/1000;
   group.position.set(p.x/1000,p.z/1000,W-p.y/1000-w);group.userData={id:item.id};
   const palletH=Math.min(.144,h*.35);const bodies=[];
   // Overall dimensions already include the pallet. The body stays inside that envelope.
   const cols=Math.max(1,Math.round(w/.8)),rows=Math.max(1,Math.round(l/1.2));
   for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const pw=w/cols,pl=l/rows,cx=(row+.5)*pl,cz=(col+.5)*pw;
    bodies.push(this.box(pl-.018,palletH*.58,pw-.018,'#a78c64',cx,palletH*.35,cz,group));
    for(let board=0;board<3;board++)bodies.push(this.box(pl-.025,palletH*.23,pw/3-.025,'#c1a477',cx,palletH*.81,(col+(board+.5)/3)*pw,group));
   }
   const body=this.box(l-.022,h-palletH-.012,w-.022,cargoColor(item),l/2,palletH+(h-palletH)/2,w/2,group);
   body.userData.id=item.id;bodies.push(body);
   const edges=new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),new THREE.LineBasicMaterial({color:0x344c3a,transparent:true,opacity:.33}));edges.position.copy(body.position);group.add(edges);
   for(const offset of [.22,.78]){
    bodies.push(this.box(.022,h-palletH,.005,'#50604e',l*offset,palletH+(h-palletH)/2,.009,group));
    bodies.push(this.box(.022,.008,w-.014,'#50604e',l*offset,h+.002,w/2,group));
   }
   const label=this.textSprite(String(item.number).padStart(2,'0'),{size:.34,color:cargoInk(item),background:cargoColor(item)});label.position.set(l/2,h+.23,w/2);group.add(label);
   this.meshes.set(item.id,{group,body,bodies,edges,label,color:cargoColor(item)});this.content.add(group);
  }
  this.controls.target.set(L/2,.8,W/2);this.fit(null,false);this.needsRender=true;
 }
 update({overview,currentIds,completed,showFuture,stage}){
  if(!this.shipment)return;
  for(const [id,m]of this.meshes){
   const current=currentIds.includes(id),done=completed.has(id),future=!overview&&!current&&!done;
   m.group.visible=!future||showFuture;
   const opacity=future?.07:done&&!overview?.64:1;
   for(const b of m.bodies){const transparent=opacity<1;if(b.material.transparent!==transparent)b.material.needsUpdate=true;b.material.opacity=opacity;b.material.transparent=transparent;b.material.depthWrite=!future;b.castShadow=!future;}
   m.body.material.color.set(m.color);
   m.body.material.emissive.set(current?m.color:'#000000');m.body.material.emissiveIntensity=current?.16:0;
   m.edges.material.opacity=future?.1:current?1:.33;m.edges.material.color.set(current?'#111827':'#344c3a');
   m.label.visible=!future&&(overview||current||done);m.label.material.opacity=done&&!overview?.65:1;
   m.group.userData.pickable=!future;
  }
  this.highlight.visible=!overview&&!!stage;
  if(stage){const end=Math.max(...stage.items.map(i=>(i.placement.x+i.length)/1000));this.highlight.scale.x=Math.max(.3,end-stage.x/1000);this.highlight.position.x=(stage.x/1000+end)/2;}
  this.needsRender=true;
 }
 resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);if(this.shipment)this.fit(this.lastStage||null,false);this.needsRender=true;}
 fit(stage=null,animated=true){
  if(!this.shipment)return;this.lastStage=stage;const L=this.shipment.trailer.length/1000,W=this.shipment.trailer.width/1000;
  let centre=L/2,span=L;
  if(stage){const end=Math.max(...stage.items.map(i=>(i.placement.x+i.length)/1000));centre=(stage.x/1000+end)/2;span=Math.max(4.5,end-stage.x/1000+1.5);}
  const narrow=this.container.clientWidth<540;const ratio=this.camera.aspect;const distance=Math.max(span*(narrow?1.12:.82),span/(Math.max(ratio,.55)*.65));
  const target=new THREE.Vector3(centre,1.2,W/2);
  let position;
  if(this.view==='top')position=new THREE.Vector3(centre,Math.max(8,distance),W/2+.001);
  else if(this.view==='rear')position=new THREE.Vector3(L+Math.max(6,span*.6),4.6,W/2+.001);
  else position=new THREE.Vector3(centre+distance*.57,distance*.58,W/2+distance*.64);
  // Fit projected cargo bounds, including labels, on narrow and short viewports.
  const probe=this.camera.clone(),direction=position.clone().sub(target).normalize();let radius=position.distanceTo(target);
  const start=stage?stage.x/1000-.45:-.6;
  const end=stage?Math.max(...stage.items.map(i=>(i.placement.x+i.length)/1000))+.45:L+1;
  const overflowAt=r=>{
   position.copy(target).addScaledVector(direction,r);probe.position.copy(position);probe.lookAt(target);probe.updateMatrixWorld();probe.updateProjectionMatrix();
   let overflow=0;
   for(const x of [start,end])for(const y of [-.3,3.1])for(const z of [-.25,W+.3]){const point=new THREE.Vector3(x,y,z).project(probe);overflow=Math.max(overflow,Math.abs(point.x)/.86,Math.abs(point.y)/.72);}
   return overflow;
  };
  while(overflowAt(radius)>1&&radius<70)radius*=1.35;
  let low=2,high=radius;
  for(let n=0;n<16;n++){const mid=(low+high)/2;if(overflowAt(mid)>1)low=mid;else high=mid;}
  position.copy(target).addScaledVector(direction,high*1.02);
  if(!animated||window.matchMedia('(prefers-reduced-motion: reduce)').matches){this.camera.position.copy(position);this.controls.target.copy(target);this.controls.update();}
  else this.pendingCamera={from:this.camera.position.clone(),to:position,fromTarget:this.controls.target.clone(),toTarget:target,start:performance.now()};
  this.needsRender=true;
 }
 setView(view,stage){this.view=view;this.fit(stage);}
 zoom(factor){this.pendingCamera=null;const direction=this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor);const d=direction.length();if(d>=this.controls.minDistance&&d<=this.controls.maxDistance)this.camera.position.copy(this.controls.target.clone().add(direction));this.controls.update();this.needsRender=true;}
 pick(e){
  const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
  const targets=[...this.meshes.values()].filter(m=>m.group.visible&&m.group.userData.pickable).map(m=>m.body);
  const hit=this.raycaster.intersectObjects(targets)[0];if(hit)this.onPick(hit.object.userData.id);
 }
 animate(time){
  this.frame=requestAnimationFrame(this.animate);
  if(document.hidden)return;
  if(this.pendingCamera){const a=this.pendingCamera,t=Math.min(1,(time-a.start)/650),v=1-(1-t)**3;this.camera.position.lerpVectors(a.from,a.to,v);this.controls.target.lerpVectors(a.fromTarget,a.toTarget,v);this.needsRender=true;if(t===1)this.pendingCamera=null;}
  this.controls.update();if(this.needsRender){this.renderer.render(this.scene,this.camera);this.needsRender=false;}
 }
}
