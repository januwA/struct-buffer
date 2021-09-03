!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.StructBuffer=e():t.StructBuffer=e()}(this,(function(){return(()=>{"use strict";var t={d:(e,n)=>{for(var s in n)t.o(n,s)&&!t.o(e,s)&&Object.defineProperty(e,s,{enumerable:!0,get:n[s]})},o:(t,e)=>Object.prototype.hasOwnProperty.call(t,e),r:t=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})}},e={};t.r(e),t.d(e,{BOOL:()=>et,BYTE:()=>nt,CHAR:()=>ut,CStruct:()=>s,DOUBLE:()=>ct,DWORD:()=>rt,FLOAT:()=>ot,INT:()=>dt,LONG:()=>pt,LONGLONG:()=>bt,QWORD:()=>it,SHORT:()=>ht,Struct:()=>Bt,StructBuffer:()=>O,TEXT:()=>p,UCHAR:()=>at,UINT:()=>lt,ULONG:()=>gt,ULONGLONG:()=>yt,USHORT:()=>ft,WORD:()=>st,bitFields:()=>z,bits:()=>T,bool:()=>v,calcsize:()=>Dt,char:()=>B,createDataView:()=>o,display:()=>Lt,double:()=>Q,float:()=>P,int:()=>I,int16_t:()=>K,int32_t:()=>M,int64_t:()=>q,int8_t:()=>Y,iter_unpack:()=>St,long:()=>H,longlong:()=>F,makeDataView:()=>c,pack:()=>jt,pack_into:()=>kt,padding_t:()=>D,registerType:()=>j,sbytes:()=>a,sbytes2:()=>d,short:()=>C,sizeof:()=>g,string_t:()=>S,sview:()=>l,typedef:()=>k,uchar:()=>R,uint:()=>$,uint16_t:()=>J,uint32_t:()=>Z,uint64_t:()=>tt,uint8_t:()=>X,ulong:()=>V,ulonglong:()=>W,unpack:()=>Tt,unpack_from:()=>zt,ushort:()=>G});var n={};t.r(n),t.d(n,{BOOL:()=>et,BYTE:()=>nt,CHAR:()=>ut,DOUBLE:()=>ct,DWORD:()=>rt,FLOAT:()=>ot,INT:()=>dt,LONG:()=>pt,LONGLONG:()=>bt,QWORD:()=>it,SHORT:()=>ht,UCHAR:()=>at,UINT:()=>lt,ULONG:()=>gt,ULONGLONG:()=>yt,USHORT:()=>ft,WORD:()=>st,bool:()=>v,char:()=>B,double:()=>Q,float:()=>P,int:()=>I,int16_t:()=>K,int32_t:()=>M,int64_t:()=>q,int8_t:()=>Y,long:()=>H,longlong:()=>F,padding_t:()=>D,short:()=>C,string_t:()=>S,uchar:()=>R,uint:()=>$,uint16_t:()=>J,uint32_t:()=>Z,uint64_t:()=>tt,uint8_t:()=>X,ulong:()=>V,ulonglong:()=>W,ushort:()=>G});var s={};function r(t,e,n=!1){let s=t;n&&"string"==typeof s&&(s=s.split(""));for(let t=e.length-1;t>=1;t--){const r=t===e.length-1,i=e[t];s=s.reduce(((t,e,n)=>(n%i==0&&t.push([]),t[t.length-1].push(e),t)),[]),n&&r&&(s=s.map((t=>t.join(""))))}return s}function i(t,e,n){for(;e-- >0;)t.setUint8(n++,0)}function o(t,e){return e||new DataView(new ArrayBuffer(t))}function c(t){if(t instanceof DataView)return t;if(Array.isArray(t)&&(t=Uint8Array.from(t)),!ArrayBuffer.isView(t))throw new Error(`Type Error: (${t}) is not an ArrayBuffer!!!`);return new DataView(t.buffer)}function u(t,e){return function(t,e){return new Proxy(t,{get:(t,n)=>n in t?t[n]:/\d+/.test(n.toString())?e(t,parseInt(n)):void 0})}(t,((n,s)=>{const r=new e;return Object.setPrototypeOf(r,t),Object.assign(r,n),r.deeps=[...t.deeps??[],s],r}))}function a(t){return(t=t.replace(/0x|h|\\x|\s/gi,"")).length%2!=0&&(t=t.slice(0,-1)),t=t.replace(/([0-9a-f]{2})(?=[0-9a-f])/gi,"$1 "),new DataView(Uint8Array.from(t.split(/\s+/).map((t=>parseInt(t,16)))).buffer)}t.r(s),t.d(s,{defaultTypes:()=>mt,from:()=>_t,parse:()=>wt});const h=/^(0x([0-9a-f]{1,2})|([0-9a-f]{1,2})h|\\x([0-9a-f]{1,2}))/i,f=/0x([0-9a-f]{1,2})|([0-9a-f]{1,2})h|\\x([0-9a-f]{1,2})/i;function d(t,e=new TextEncoder){let n;const s=[];for(;t.length;)if(n=t.match(h),n&&n[1]){const e=n[2]??n[3]??n[4]??0;s.push(parseInt(e,16)),t=t.substr(n[1].length)}else if(t.length){const n=t.search(f);if(n<0)s.push(...e.encode(t)),t="";else{const r=t.substr(0,n);s.push(...e.encode(r)),t=t.substr(n)}}return new DataView(Uint8Array.from(s).buffer)}function l(t){const e=c(t),n=[];for(let t=0;t<e.byteLength;t++)n.push(e.getUint8(t).toString(16).padStart(2,"0"));return n.join(" ")}function p(t,e,n){const s=c(t);e||n?(void 0!==e&&"string"==typeof e||"function"==typeof e)&&(n=e,e=new TextDecoder):e=new TextDecoder;let r=0,i="",o=[];for(;;)try{const t=s.getUint8(r++);t>=32?o.push(t):(o.length&&(i+=e.decode(Uint8Array.from(o)),o=[]),i+=n?"string"==typeof n?n:n(t):".")}catch(t){o.length&&(i+=e.decode(Uint8Array.from(o)));break}return i}function g(t){if(t instanceof O){let e=0;const n=t.maxSize,s=b(t,1);for(;(s+e++)%n;);return(s+e-1)*t.count}return t.isList?t.size*t.count:t.size}function b(t,e){return Object.values(t.struct).reduce(((t,e)=>t+(e instanceof O?e.byteLength:g(e))),0)*(e??t.count)}class y{constructor(){return u(this,y)}}const m={textDecode:new TextDecoder,textEncoder:new TextEncoder,littleEndian:void 0};class O extends Array{constructor(t,e,n){return super(),this.structName=t,this.struct=e,this.deeps=[],this.config=Object.assign({},m),Object.assign(this.config,n),this.structKV=Object.entries(e),u(this,y)}get isList(){return!!this.deeps.length}get count(){return this.deeps.reduce(((t,e)=>t*e),1)}get byteLength(){return b(this)}get maxSize(){return Math.max(...Object.values(this.struct).map((t=>t instanceof O?t.maxSize:t.size)))}decode(t,e=!1,n=0){e=this.config.littleEndian??e,t=c(t);const s=[];let i=this.count;for(;i--;){const r=this.structKV.reduce(((s,[r,i])=>(i instanceof O?(s[r]=i.decode(t,i.config.littleEndian??e,n),n+=i.byteLength):(s[r]=i.decode(t,e,n,this.config.textDecode),n+=g(i)),s)),{});s.push(r)}return this.isList?r(s,this.deeps):s[0]}encode(t,e=!1,n=0,s){e=this.config.littleEndian??e;const r=o(this.byteLength,s);this.isList&&Array.isArray(t)&&(t=t.flat());for(let s=0;s<this.count;s++){const o=this.isList?t[s]:t;if(void 0!==o)this.structKV.reduce(((t,[s,r])=>{const i=o[s];return r instanceof O?(r.encode(i,r.config.littleEndian??e,n,t),n+=r.byteLength):(r.encode(i,e,n,t,this.config.textEncoder),n+=g(r)),t}),r);else{const t=this.byteLength/this.count;i(r,t,n),n+=t}}return r}}const w="float",_="double",L={1:{1:"getUint8",0:"getInt8"},2:{1:"getUint16",0:"getInt16"},4:{1:"getUint32",0:"getInt32"},8:{1:"getBigUint64",0:"getBigInt64"},f:"getFloat32",d:"getFloat64"};class N{constructor(){return u(this,N)}}class x extends Array{constructor(t,e,n){super(),this.size=e,this.unsigned=n,this.deeps=[],this.names=Array.isArray(t)?t:[t];const[s,r]=function(t){let e;const n=t.isName(w.toLowerCase())||t.isName(w.toUpperCase()),s=t.isName(_.toLowerCase())||t.isName(_.toUpperCase());if(n&&(e=L.f),s&&(e=L.d),e||(e=L[t.size][+t.unsigned]),!e)throw new Error(`StructBuffer: Unrecognized ${t} type.`);return[e,e.replace(/^g/,"s")]}(this);return this.set=r,this.get=s,u(this,N)}get isList(){return!!this.deeps.length}get count(){return this.deeps.reduce(((t,e)=>t*e),1)}is(t){return t.names.some((t=>this.names.includes(t)))}isName(t){return this.names.includes(t)}decode(t,e=!1,n=0){t=c(t);const s=[];let i=this.count;for(;i--;)s.push(t[this.get](n,e)),n+=this.size;return this.isList?r(s,this.deeps,!1):s[0]}encode(t,e=!1,n=0,s){const r=o(this.count*this.size,s);this.isList&&Array.isArray(t)&&(t=t.flat());for(let s=0;s<this.count;s++){const i=(this.isList?t[s]:t)??0;try{r[this.set](n,i,e)}catch(t){r[this.set](n,BigInt(i),e)}n+=this.size}return r}}class A extends x{constructor(t,e){super("<bits>",t,!0),this.bits=e}decode(t,e=!1,n=0){const s=super.decode(t,e,n);if(this.isList&&Array.isArray(s))return s.map((t=>{const e={};return Object.entries(this.bits).forEach((([n,s])=>{e[n]=(t&1<<s)>>s})),e}));{const t={};return Object.entries(this.bits).forEach((([e,n])=>{t[e]=(s&1<<n)>>n})),t}}encode(t,e=!1,n=0,s){const r=o(this.count*this.size,s);if(this.isList&&Array.isArray(t)){for(let s=0;s<this.count;s++){let i=0;Object.entries(t[s]).forEach((([t,e])=>{const n=this.bits[t];void 0!==n&&(i|=e<<n)})),r[this.set](n,i,e),n+=this.size}return r}{let s=0;return Object.entries(t).forEach((([t,e])=>{const n=this.bits[t];void 0!==n&&(s|=e<<n)})),r[this.set](n,s,e),r}}}class E extends x{constructor(t,e){super("<bit-fields>",t,!0),this.bitFields=e}decode(t,e=!1,n=0){const s=super.decode(t,e,n);let r=0;const i=(t,e)=>{let n=0,s=0;for(;e--;)n|=(t>>r&1)<<s,r++,s++;return n},o={};return this.isList&&Array.isArray(s)?s.map((t=>(Object.entries(this.bitFields).forEach((([e,n])=>{o[e]=i(t,n)})),o))):(Object.entries(this.bitFields).forEach((([t,e])=>{o[t]=i(s,e)})),o)}encode(t,e=!1,n=0,s){const r=o(this.count*this.size,s),i=t=>{let e=0,n=0;return Object.entries(t).forEach((([t,s])=>{const r=this.bitFields[t];void 0!==r&&(e|=s<<n,n+=r)})),e};if(this.isList&&Array.isArray(t)){for(let s=0;s<this.count;s++)r[this.set](n,i(t[s]),e),n+=this.size;return r}{const s=i(t);return r[this.set](n,s,e),r}}}class U extends x{constructor(t,e){super(t,e.size,e.unsigned)}decode(t,e=!1,n=0){let s=super.decode(t,e,n);return Array.isArray(s)?(s=s.flat().map((t=>Boolean(t))),s=r(s,this.deeps)):s=Boolean(s),s}encode(t,e=!1,n=0,s){return t&&Array.isArray(t)?t=t.flat().map((t=>Number(Boolean(t)))):t&&(t=Number(Boolean(t))),super.encode(t,e,n,s)}}function j(t,e,n=!0){return new x(t,e,n)}function k(t,e){return j(t,e.size,e.unsigned)}function T(t,e){return new A(t.size,e)}function z(t,e){return new E(t.size,e)}const S=new class extends x{constructor(){super("string_t",1,!0),this.textDecode=new TextDecoder,this.textEncoder=new TextEncoder}decode(t,e=!1,n=0,s){t=c(t),s??(s=this.textDecode);const i=[];let o=this.count;for(;o--;){let r=t[this.get](n,e);if(0===r)break;r=s.decode(new Uint8Array([r])),i.push(r),n+=this.size}return this.deeps.length<2?i.join(""):this.isList?r(i,this.deeps,!0):i[0]}encode(t,e=!1,n=0,s,r){const i=o(this.count*this.size,s);Array.isArray(t)&&(t=t.flat().join("")),r??(r=this.textEncoder);const c=r.encode(t);for(let t=0;t<this.count;t++){const s=c[t]??0;try{i[this.set](n,s,e)}catch(t){i[this.set](n,BigInt(s),e)}n+=this.size}return i}},D=new class extends x{constructor(){super("padding_t",1,!0)}decode(t,e=!1,n=0){t=c(t);let s=g(this);const r=[];for(;s--;)r.push(t[this.get](n,e)),n++;return r}encode(t=0,e=!1,n=0,s){const r=o(this.count*this.size,s);"number"!=typeof t&&(t=0);let i=g(this);for(;i-- >0;)r.setUint8(n++,t);return r}},B=j(["char","signed char"],1,!1),v=new U("bool",B),R=j("unsigned char",1),C=j(["short","short int","signed short","signed short int"],2,!1),G=j(["unsigned short","unsigned short int"],2),I=j(["int","signed","signed int"],4,!1),$=j(["unsigned","unsigned int"],4),H=j(["long","long int","signed long","signed long int"],4,!1),V=j(["unsigned long","unsigned long int"],4),F=j(["long long","long long int","signed long long","signed long long int"],8,!1),W=j(["unsigned long long","unsigned long long int"],8),P=j(w,4),Q=j([_,"long double"],8),Y=k(["int8_t","__int8"],B),K=k(["int16_t","__int16"],C),M=k(["int32_t","__int32"],I),q=k(["int64_t","__int64"],F),X=k(["uint8_t","unsigned __int8"],R),J=k(["uint16_t","unsigned __int16"],G),Z=k(["uint32_t","unsigned __int32"],$),tt=k(["uint64_t","unsigned __int64"],W),et=new U("BOOL",I),nt=k("BYTE",R),st=k("WORD",G),rt=k("DWORD",V),it=j("QWORD",8),ot=k(w.toUpperCase(),P),ct=k(_.toUpperCase(),Q),ut=k("CHAR",B),at=k("UCHAR",R),ht=k("SHORT",C),ft=k("USHORT",G),dt=k("INT",I),lt=k("UINT",$),pt=k("LONG",H),gt=k("ULONG",V),bt=k("LONGLONG",F),yt=k("ULONGLONG",W),mt=n,Ot=/\s*(?<typedef>typedef)?\s*(?<struct>struct)\s*(?<structName>\w+)\s*{(?<props>[^}]*)}(\s*(?<aliasName1>\w+)?\s*,\s*(?<aliasName2>\*\w+)?\s*;\s*)?/gi;function wt(t,e){e=Object.assign(mt,e);const n=[...(t=t.replace(/\/\/[^]*?\n|\/\*[^]*\*\//g,"")).matchAll(Ot)];if(!n||!n.length)throw new Error("[parseCStruct]: parse error");const s={};for(const t of n){const e=t.groups;if(!e?.struct)throw new Error('[parseCStruct]: Undefined identifier "struct"');const n=e?.aliasName1??e?.structName;if(!n)throw new Error('[parseCStruct]: You need to create a name for "struct"');const r={};e.props&&e.props.trim()&&e.props.trim().split(/\n/).map((t=>{const e=t.trim().replace(/;$/,"").split(/\s+/).map((t=>t.trim()));let n=e.pop(),s=e.join(" "),r=1,i=!1;const o=n.match(/\[(\d+)+\]/);return o&&(n=n.substr(0,o.index),r=parseInt(o[1])||1,i=!0),{type:s,name:n,count:r,isList:i}})).forEach((t=>{r[t.name]=t})),s[n]=r}const r=Object.keys(s).reduce(((t,e)=>Object.assign(t,{[e]:null})),{});for(const[t,n]of Object.entries(s))r[t]=new O(t,Object.entries(n).reduce(((t,[n,i])=>{if(i.type in s)return t[n]=r[i.type],t;if(!e)return t;let o=e[i.type];if(o||(o=Object.values(e).find((t=>{if(t instanceof x&&t.isName(i.type))return t}))),!o)throw new Error(`[parseCStruct]: The (${i.type}) type was not found in styles`);return t[n]=i.isList?o[i.count]:o,t}),{}));return r}function _t(t){let e="";for(let[n,s]of Object.entries(t.struct)){const t=s instanceof x?S.is(s)?B.names[0]:s.names[0]:s.structName;s.isList&&(n=`${n}${s.deeps.map((t=>`[${t}]`)).join("")}`),e+=`\t${t} ${n};\n`}return`\ntypedef struct _${t.structName}\n{\n${e.replace(/\n$/,"")}\n} ${t.structName}, *${t.structName};\n`}function Lt(t,e,n){n=Object.assign({hex:!0,littleEndian:!1},n);let s=0;const r=[];for(;;)try{let i=t[e.get](s,n.littleEndian);n.hex&&(i=i.toString(16).toUpperCase().padStart(2*e.size,"0")),r.push({offset:s,value:i}),s+=e.size}catch(t){break}return r}const Nt=[">","<","!"],xt=/^(\d+)(?=\w|\?)/i;function At(t){let e;const n=[];for(;t.length;){e=t.match(xt);let s=1;switch(e&&e[1]&&(s=parseInt(e[1]),t=t.substr(e[1].length)),t[0]){case"x":n.push(D[s]);break;case"c":case"b":n.push(B[s]);break;case"B":n.push(R[s]);break;case"?":n.push(v[s]);break;case"h":n.push(C[s]);break;case"H":n.push(G[s]);break;case"i":case"n":n.push(I[s]);break;case"I":case"N":n.push($[s]);break;case"l":n.push(H[s]);break;case"L":n.push(V[s]);break;case"q":n.push(F[s]);break;case"Q":n.push(W[s]);break;case"e":case"f":n.push(P[s]);break;case"d":n.push(Q[s]);break;case"s":case"p":n.push(S[s]);break;default:throw new Error(`没有(${t[0]})格式!`)}t=t.substr(1)}return n}function Et(t){switch(t){case">":case"!":return!1;case"<":return!0;default:throw new Error("错误的字节序")}}function Ut(t,e){t=t.replace(/\s/g,"");let n=Nt[0];return Nt.includes(t[0])&&(n=t[0],t=t.substr(1)),{littleEndian:Et(n),view:c(e),types:At(t)}}function jt(t,...e){return kt(t,o(Dt(t)),0,...e)}function kt(t,e,n,...s){const{littleEndian:r,types:i,view:o}=Ut(t,e);for(;i.length;){const t=i.shift();if(!t)break;if(t.is(D))t.encode(0,r,n,o);else if(t.is(S))t.encode(s.shift(),r,n,o);else{const e=[];for(let n=0;n<t.count;n++)e.push(s.shift());t.encode(e,r,n,o)}n+=g(t)}return o}function Tt(t,e,n=0){const{littleEndian:s,types:r,view:i}=Ut(t,e),o=[];for(;r.length;){const t=r.shift();if(!t)break;t.is(D)||o.push(t.decode(i,s,n)),n+=g(t)}return o.flat()}function zt(t,e,n=0){return Tt(t,e,n)}function St(t,e){const n=Dt(t);let s=0;return{next(){try{return{value:Tt(t,e,s),done:!(s+=n)}}catch(t){return{value:null,done:!0}}},[Symbol.iterator](){return this}}}function Dt(t){return t=t.replace(/\s/g,""),Nt.includes(t[0])&&(t=t.substr(1)),At(t).reduce(((t,e)=>t+g(e)),0)}class Bt{constructor(t){this.format=t,this.size=Dt(t)}pack(...t){return kt(this.format,o(this.size),0,...t)}pack_into(t,e,...n){return kt(this.format,t,e,...n)}unpack(t,e=0){return Tt(this.format,t,e)}unpack_from(t,e=0){return Tt(this.format,t,e)}iter_unpack(t){return St(this.format,t)}}return e})()}));