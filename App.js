import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY=0,RED=1,RED_KING=2,BLACK=3,BLACK_KING=4;
const POLL_MS=1800, HB_MS=3000, OFFLINE_MS=10000;
const F="'Palatino Linotype','Book Antiqua',Palatino,serif";
const GOLD="#d4a84b", BG="#0b0908", CARD="#18120a";
const AVATAR_COLORS=["#8b4513","#1e6b8a","#3a7a28","#7a2080","#7a6a18","#7a2828","#1a5a5a"];

// ─── Game Logic ───────────────────────────────────────────────────────────────
const isRed=p=>p===RED||p===RED_KING;
const isBlack=p=>p===BLACK||p===BLACK_KING;
const isKing=p=>p===RED_KING||p===BLACK_KING;
const belongs=(p,pl)=>pl==="red"?isRed(p):isBlack(p);
const opp=pl=>pl==="red"?"black":"red";

function initBoard(){
  const b=Array(8).fill(null).map(()=>Array(8).fill(EMPTY));
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)
    if((r+c)%2===1){if(r<3)b[r][c]=BLACK;else if(r>4)b[r][c]=RED;}
  return b;
}
function getJumps(board,r,c,pl){
  const piece=board[r][c],flying=isKing(piece);
  const dirs=[];
  if(isRed(piece)||isKing(piece))dirs.push([-1,-1],[-1,1]);
  if(isBlack(piece)||isKing(piece))dirs.push([1,-1],[1,1]);
  const jumps=[];
  for(const[dr,dc]of dirs){
    if(flying){
      let step=1,foe=null;
      while(true){
        const nr=r+dr*step,nc=c+dc*step;
        if(nr<0||nr>=8||nc<0||nc>=8)break;
        const sq=board[nr][nc];
        if(foe){if(sq!==EMPTY)break;jumps.push({from:[r,c],to:[nr,nc],over:foe});}
        else{if(sq!==EMPTY){if(!belongs(sq,pl))foe=[nr,nc];else break;}}
        step++;
      }
    }else{
      const mr=r+dr,mc=c+dc,lr=r+2*dr,lc=c+2*dc;
      if(lr<0||lr>=8||lc<0||lc>=8)continue;
      if(board[lr][lc]===EMPTY&&board[mr][mc]!==EMPTY&&!belongs(board[mr][mc],pl))
        jumps.push({from:[r,c],to:[lr,lc],over:[mr,mc]});
    }
  }
  return jumps;
}
function getMoves(board,r,c,pl){
  const piece=board[r][c],flying=isKing(piece);
  const dirs=[];
  if(isRed(piece)||isKing(piece))dirs.push([-1,-1],[-1,1]);
  if(isBlack(piece)||isKing(piece))dirs.push([1,-1],[1,1]);
  const moves=[];
  for(const[dr,dc]of dirs){
    if(flying){let step=1;while(true){const nr=r+dr*step,nc=c+dc*step;if(nr<0||nr>=8||nc<0||nc>=8)break;if(board[nr][nc]!==EMPTY)break;moves.push({from:[r,c],to:[nr,nc],over:null});step++;}}
    else{const nr=r+dr,nc=c+dc;if(nr>=0&&nr<8&&nc>=0&&nc<8&&board[nr][nc]===EMPTY)moves.push({from:[r,c],to:[nr,nc],over:null});}
  }
  return moves;
}
function allJumps(b,pl){const a=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(belongs(b[r][c],pl))a.push(...getJumps(b,r,c,pl));return a;}
function allMoves(b,pl){const j=allJumps(b,pl);if(j.length)return j;const m=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(belongs(b[r][c],pl))m.push(...getMoves(b,r,c,pl));return m;}
function applyMove(board,move){
  const nb=board.map(r=>[...r]);
  const[fr,fc]=move.from,[tr,tc]=move.to;
  nb[tr][tc]=nb[fr][fc];nb[fr][fc]=EMPTY;
  if(move.over){const[or,oc]=move.over;nb[or][oc]=EMPTY;}
  if(nb[tr][tc]===RED&&tr===0)nb[tr][tc]=RED_KING;
  if(nb[tr][tc]===BLACK&&tr===7)nb[tr][tc]=BLACK_KING;
  return nb;
}
function countP(b){let r=0,bl=0;for(let i=0;i<8;i++)for(let j=0;j<8;j++){if(isRed(b[i][j]))r++;if(isBlack(b[i][j]))bl++;}return{red:r,black:bl};}
function genCode(){return Math.random().toString(36).substring(2,8).toUpperCase();}
function avatarColor(name){return AVATAR_COLORS[name.charCodeAt(0)%AVATAR_COLORS.length];}
function initials(name){return name.slice(0,2).toUpperCase();}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const sget=async(k,sh=true)=>{try{const r=await window.storage.get(k,sh);return r?JSON.parse(r.value):null;}catch{return null;}};
const sset=async(k,v,sh=true)=>{try{await window.storage.set(k,JSON.stringify(v),sh);return true;}catch{return false;}};
const sdel=async(k,sh=true)=>{try{await window.storage.delete(k,sh);}catch{}};
const slist=async(prefix,sh=true)=>{try{const r=await window.storage.list(prefix,sh);return r?.keys||[];}catch{return[];}};

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function Btn({children,onClick,disabled,variant="primary",style={}}){
  const base={padding:"11px 20px",border:"none",borderRadius:6,cursor:disabled?"default":"pointer",fontSize:13,fontFamily:F,fontWeight:"bold",letterSpacing:1,transition:"opacity 0.2s",...style};
  const variants={
    primary:{background:disabled?"#2a1e0c":"#d4a84b",color:disabled?"#4a3a20":"#0b0908"},
    ghost:{background:"transparent",color:"#6a5a30",border:"1px solid #2a1a08"},
    danger:{background:"transparent",color:"#8a3820",border:"1px solid #3a1808"},
    green:{background:disabled?"#1a2a18":"#2a6a20",color:disabled?"#2a3a28":"#c8f0c0"},
  };
  return <button onClick={!disabled?onClick:undefined} style={{...base,...variants[variant],opacity:disabled?0.5:1}}>{children}</button>;
}
function Card({children,style={}}){
  return <div style={{background:CARD,border:"1px solid #2a1808",borderRadius:10,padding:"24px 28px",...style}}>{children}</div>;
}
function Avatar({name,size=44}){
  const c=avatarColor(name);
  return(
    <div style={{width:size,height:size,borderRadius:"50%",background:`radial-gradient(circle at 38% 32%,${c}cc,${c}44)`,border:`2px solid ${c}88`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:"bold",color:"#e8dcc8",flexShrink:0,fontFamily:F}}>
      {initials(name)}
    </div>
  );
}
function Badge({children,color="#4a8a3a"}){
  return <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:color+"22",color,border:`1px solid ${color}44`}}>{children}</span>;
}
function Title({sub}){
  return(
    <div style={{textAlign:"center",marginBottom:24}}>
      <div style={{fontSize:9,letterSpacing:6,color:"#3a2a14",marginBottom:4}}>THE ROYAL GAME OF</div>
      <h1 style={{margin:0,fontSize:42,fontWeight:"normal",color:GOLD,letterSpacing:5,textShadow:"0 0 50px rgba(212,168,75,0.35)"}}>DRAFT PESA</h1>
      <div style={{
        marginTop:10,
        fontSize:17,
        fontWeight:"bold",
        letterSpacing:4,
        color:"#7fffb2",
        textShadow:"0 0 8px #00ff88, 0 0 20px #00ff88, 0 0 40px #00cc66, 0 0 70px #00aa44",
        animation:"glowpulse 2s ease-in-out infinite",
        textTransform:"uppercase",
      }}>
        KARIBU TUZICHAPE
      </div>
      {sub&&<div style={{fontSize:12,color:"#5a4a28",marginTop:6,letterSpacing:1}}>{sub}</div>}
      <style>{`@keyframes glowpulse{0%,100%{text-shadow:0 0 8px #00ff88,0 0 20px #00ff88,0 0 40px #00cc66,0 0 70px #00aa44;opacity:1;}50%{text-shadow:0 0 16px #00ff88,0 0 40px #00ff88,0 0 80px #00cc66,0 0 120px #00aa44;opacity:0.85;}}`}</style>
    </div>
  );
}
function Screen({children,center=true}){
  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:F,color:"#e8dcc8",padding:"20px 16px",display:"flex",flexDirection:"column",alignItems:"center",...(center?{justifyContent:"center"}:{})}}>
      {children}
    </div>
  );
}

// ─── Piece ────────────────────────────────────────────────────────────────────
function Piece({type,sel,cs}){
  const red=isRed(type),king=isKing(type),sz=cs*0.72;
  return(
    <div style={{width:sz,height:sz,borderRadius:"50%",position:"relative",zIndex:3,transform:sel?"scale(1.12)":"scale(1)",transition:"transform 0.15s",cursor:"pointer",background:red?"radial-gradient(circle at 38% 35%,#e8614a,#b43220 60%,#7a1c10)":"radial-gradient(circle at 38% 35%,#666,#1a1a1a 60%,#000)",boxShadow:red?(sel?"0 0 0 3px #d4a84b,0 4px 14px rgba(180,50,32,0.8)":"0 3px 10px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,150,120,0.3)"):(sel?"0 0 0 3px #d4a84b,0 4px 14px rgba(0,0,0,0.9)":"0 3px 10px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.1)"),display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"absolute",top:"14%",left:"20%",width:"35%",height:"25%",borderRadius:"50%",background:"rgba(255,255,255,0.25)",transform:"rotate(-30deg)",pointerEvents:"none"}}/>
      {king&&<div style={{fontSize:sz*0.42,lineHeight:1,filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.8))",zIndex:4}}>👑</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH GATE — Login / Register
// ══════════════════════════════════════════════════════════════════════════════
function AuthGate({onDone}){
  const [mode,setMode]=useState("login"); // login | register
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const [showPw,setShowPw]=useState(false);

  // Check for saved session on mount
  useEffect(()=>{
    try{
      const saved=localStorage.getItem("dp_session");
      if(saved){const s=JSON.parse(saved);if(s?.id&&s?.username)onDone(s);}
    }catch{}
  },[]);

  const hashPw=async pw=>{
    const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pw+"dp_salt_2024"));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  };

  const handleRegister=async()=>{
    setErr("");
    if(!username.trim()){setErr("Username is required.");return;}
    if(username.trim().length<3){setErr("Username must be at least 3 characters.");return;}
    if(!/^[a-zA-Z0-9_]+$/.test(username.trim())){setErr("Username: letters, numbers and _ only.");return;}
    if(password.length<4){setErr("Password must be at least 4 characters.");return;}
    if(password!==confirm){setErr("Passwords do not match.");return;}
    setLoading(true);
    const key=`dp:user:${username.trim().toLowerCase()}`;
    const existing=await sget(key);
    if(existing){setErr("Username already taken. Try another.");setLoading(false);return;}
    const hash=await hashPw(password);
    const userId="u"+genCode();
    const account={id:userId,username:username.trim(),hash,wins:0,losses:0,gamesPlayed:0,joined:Date.now()};
    await sset(key,account);
    const session={id:userId,username:username.trim(),wins:0,losses:0,gamesPlayed:0};
    localStorage.setItem("dp_session",JSON.stringify(session));
    setLoading(false);
    onDone(session);
  };

  const handleLogin=async()=>{
    setErr("");
    if(!username.trim()||!password){setErr("Enter username and password.");return;}
    setLoading(true);
    const key=`dp:user:${username.trim().toLowerCase()}`;
    const account=await sget(key);
    if(!account){setErr("Account not found. Check username or register.");setLoading(false);return;}
    const hash=await hashPw(password);
    if(hash!==account.hash){setErr("Incorrect password.");setLoading(false);return;}
    const session={id:account.id,username:account.username,wins:account.wins||0,losses:account.losses||0,gamesPlayed:account.gamesPlayed||0};
    localStorage.setItem("dp_session",JSON.stringify(session));
    setLoading(false);
    onDone(session);
  };

  const inp=(val,set,placeholder,type="text",extra={})=>(
    <div style={{position:"relative",marginBottom:14}}>
      <input value={val} onChange={e=>set(e.target.value)} type={type} placeholder={placeholder}
        onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())}
        style={{width:"100%",padding:"13px 16px",background:"#0f0b07",border:"1px solid #3a2610",
          color:"#e8dcc8",fontSize:15,borderRadius:6,outline:"none",fontFamily:F,
          boxSizing:"border-box",...extra}}/>
    </div>
  );

  return(
    <Screen>
      <Title/>
      <Card style={{maxWidth:380,width:"100%"}}>
        {/* Mode tabs */}
        <div style={{display:"flex",borderBottom:"1px solid #1e1408",marginBottom:24}}>
          {[["login","🔑 Log In"],["register","📝 Register"]].map(([m,label])=>(
            <button key={m} onClick={()=>{setMode(m);setErr("");}}
              style={{flex:1,padding:"10px 0",background:"transparent",border:"none",
                borderBottom:mode===m?`2px solid ${GOLD}`:"2px solid transparent",
                color:mode===m?GOLD:"#4a3a18",cursor:"pointer",fontSize:13,
                fontFamily:F,letterSpacing:1,marginBottom:-1}}>
              {label}
            </button>
          ))}
        </div>

        {mode==="login"&&(
          <>
            <div style={{fontSize:11,letterSpacing:3,color:"#5a4020",marginBottom:16,textAlign:"center"}}>WELCOME BACK</div>
            {inp(username,setUsername,"Username")}
            <div style={{position:"relative",marginBottom:14}}>
              <input value={password} onChange={e=>setPassword(e.target.value)}
                type={showPw?"text":"password"} placeholder="Password"
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                style={{width:"100%",padding:"13px 44px 13px 16px",background:"#0f0b07",border:"1px solid #3a2610",color:"#e8dcc8",fontSize:15,borderRadius:6,outline:"none",fontFamily:F,boxSizing:"border-box"}}/>
              <span onClick={()=>setShowPw(x=>!x)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:16,color:"#4a3a18",userSelect:"none"}}>{showPw?"🙈":"👁"}</span>
            </div>
            {err&&<div style={{color:"#c06040",fontSize:12,marginBottom:12,padding:"8px 12px",background:"rgba(120,40,20,0.15)",borderRadius:5,border:"1px solid #4a2010"}}>{err}</div>}
            <Btn onClick={handleLogin} disabled={loading} style={{width:"100%",padding:"13px",marginBottom:12}}>
              {loading?"Logging in…":"🔑 Log In"}
            </Btn>
            <div style={{textAlign:"center",fontSize:12,color:"#3a2a10"}}>
              No account? <span onClick={()=>{setMode("register");setErr("");}} style={{color:GOLD,cursor:"pointer"}}>Register here →</span>
            </div>
          </>
        )}

        {mode==="register"&&(
          <>
            <div style={{fontSize:11,letterSpacing:3,color:"#5a4020",marginBottom:16,textAlign:"center"}}>CREATE YOUR ACCOUNT</div>
            {inp(username,setUsername,"Username (letters, numbers, _)",undefined,{maxLength:18})}
            <div style={{position:"relative",marginBottom:14}}>
              <input value={password} onChange={e=>setPassword(e.target.value)}
                type={showPw?"text":"password"} placeholder="Password (min 4 chars)"
                style={{width:"100%",padding:"13px 44px 13px 16px",background:"#0f0b07",border:"1px solid #3a2610",color:"#e8dcc8",fontSize:15,borderRadius:6,outline:"none",fontFamily:F,boxSizing:"border-box"}}/>
              <span onClick={()=>setShowPw(x=>!x)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:16,color:"#4a3a18",userSelect:"none"}}>{showPw?"🙈":"👁"}</span>
            </div>
            {inp(confirm,setConfirm,"Confirm password","password")}
            {err&&<div style={{color:"#c06040",fontSize:12,marginBottom:12,padding:"8px 12px",background:"rgba(120,40,20,0.15)",borderRadius:5,border:"1px solid #4a2010"}}>{err}</div>}
            <Btn onClick={handleRegister} disabled={loading} style={{width:"100%",padding:"13px",marginBottom:12}}>
              {loading?"Creating account…":"📝 Create Account"}
            </Btn>
            <div style={{textAlign:"center",fontSize:12,color:"#3a2a10"}}>
              Have an account? <span onClick={()=>{setMode("login");setErr("");}} style={{color:GOLD,cursor:"pointer"}}>Log in →</span>
            </div>
          </>
        )}
      </Card>
      <div style={{marginTop:16,fontSize:11,color:"#2a1a08",textAlign:"center",lineHeight:1.8}}>
        Accounts are saved online — log in from any device
      </div>
    </Screen>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOBBY
// ══════════════════════════════════════════════════════════════════════════════
function Lobby({myName,onStartGame,onLogout,session}){
  const [tab,setTab]=useState("find");
  const [playerId]=useState(()=>"pl"+genCode());
  const [players,setPlayers]=useState([]);
  const [pendingIn,setPendingIn]=useState(null);
  const [pendingOut,setPendingOut]=useState(null);
  const [joinCode,setJoinCode]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [quickQueue,setQuickQueue]=useState(false);
  const [onlineCount,setOnlineCount]=useState(0);
  const hbRef=useRef(null);
  const pollRef=useRef(null);
  const pendingOutRef=useRef(pendingOut);
  pendingOutRef.current=pendingOut;
  const quickQueueRef=useRef(quickQueue);
  quickQueueRef.current=quickQueue;
  const pendingInRef=useRef(pendingIn);
  pendingInRef.current=pendingIn;

  const notify=(msg,ms=4000)=>{setNotice(msg);setTimeout(()=>setNotice(""),ms);};

  useEffect(()=>{
    const reg=async()=>{
      await sset(`dp:pl:${playerId}`,{id:playerId,name:myName,status:"online",hb:Date.now()});
      hbRef.current=setInterval(async()=>{
        const cur=await sget(`dp:pl:${playerId}`);
        if(cur)await sset(`dp:pl:${playerId}`,{...cur,hb:Date.now()});
      },HB_MS);
    };
    reg();
    return()=>{
      clearInterval(hbRef.current);
      clearInterval(pollRef.current);
      sdel(`dp:pl:${playerId}`);
      sdel(`dp:ch:${playerId}`);
    };
  },[]);

  useEffect(()=>{
    const poll=async()=>{
      const keys=await slist("dp:pl:");
      const now=Date.now(),online=[];
      for(const k of keys){
        try{
          const r=await sget(k);
          if(!r||r.id===playerId)continue;
          if(now-r.hb<OFFLINE_MS)online.push(r);
        }catch{}
      }
      setPlayers(online);
      setOnlineCount(online.length);

      const ch=await sget(`dp:ch:${playerId}`);
      if(ch&&ch.status==="pending"&&now-ch.at<30000){setPendingIn(ch);}
      else if(pendingInRef.current&&(!ch||ch.status!=="pending")){setPendingIn(null);}

      const po=pendingOutRef.current;
      if(po){
        const reply=await sget(`dp:ch:${po.toId}`);
        if(reply&&reply.roomCode===po.roomCode){
          if(reply.status==="accepted"){
            clearInterval(pollRef.current);
            await sset(`dp:pl:${playerId}`,{id:playerId,name:myName,status:"ingame",hb:Date.now()});
            onStartGame(po.roomCode,"red",myName,po.toName);return;
          }
          if(reply.status==="declined"){setPendingOut(null);notify(`${po.toName} declined your challenge.`);}
        }
        if(now-po.at>30000){setPendingOut(null);notify(`Challenge to ${po.toName} timed out.`);sdel(`dp:ch:${po.toId}`);}
      }

      if(quickQueueRef.current){
        const queue=await sget("dp:qm:queue");
        if(queue&&queue.id!==playerId&&now-queue.hb<15000){
          clearInterval(pollRef.current);
          setQuickQueue(false);
          await sdel("dp:qm:queue");
          await sset(`dp:pl:${playerId}`,{id:playerId,name:myName,status:"ingame",hb:Date.now()});
          notify("⚡ Match found! Starting…",2000);
          setTimeout(()=>onStartGame(queue.roomCode,"black",myName,queue.name),700);
        }
      }
    };
    pollRef.current=setInterval(poll,POLL_MS);
    poll();
    return()=>clearInterval(pollRef.current);
  },[playerId,myName]);

  const sendChallenge=async target=>{
    if(pendingOut||pendingIn)return;
    const code=genCode();
    const room={board:initBoard(),current:"red",log:[`⚔ ${myName} vs ${target.name}. Red moves first!`],winner:null,capRed:0,capBlack:0,moveCount:0,players:{red:playerId,black:target.id},names:{red:myName,black:target.name},version:1};
    await sset(`dp:room:${code}`,room);
    await sset(`dp:ch:${target.id}`,{fromId:playerId,fromName:myName,toId:target.id,toName:target.name,roomCode:code,status:"pending",at:Date.now()});
    setPendingOut({toId:target.id,toName:target.name,roomCode:code,at:Date.now()});
    setErr("");
  };
  const cancelChallenge=async()=>{if(pendingOut){await sdel(`dp:ch:${pendingOut.toId}`);setPendingOut(null);}};
  const acceptChallenge=async()=>{
    if(!pendingIn)return;
    await sset(`dp:ch:${playerId}`,{...pendingIn,status:"accepted"});
    await sset(`dp:pl:${playerId}`,{id:playerId,name:myName,status:"ingame",hb:Date.now()});
    clearInterval(hbRef.current);clearInterval(pollRef.current);
    onStartGame(pendingIn.roomCode,"black",myName,pendingIn.fromName);
  };
  const declineChallenge=async()=>{if(!pendingIn)return;await sset(`dp:ch:${playerId}`,{...pendingIn,status:"declined"});setPendingIn(null);};

  const joinQuickMatch=async()=>{
    setBusy(true);
    const existing=await sget("dp:qm:queue");
    const now=Date.now();
    if(existing&&existing.id!==playerId&&now-existing.hb<15000){
      await sdel("dp:qm:queue");
      await sset(`dp:pl:${playerId}`,{id:playerId,name:myName,status:"ingame",hb:Date.now()});
      setBusy(false);
      onStartGame(existing.roomCode,"black",myName,existing.name);return;
    }
    const code=genCode();
    const room={board:initBoard(),current:"red",log:[`⚡ Quick Match ready. Waiting for opponent…`],winner:null,capRed:0,capBlack:0,moveCount:0,players:{red:playerId,black:null},names:{red:myName,black:"?"},version:0};
    await sset(`dp:room:${code}`,room);
    await sset("dp:qm:queue",{id:playerId,name:myName,roomCode:code,hb:now});
    await sset(`dp:pl:${playerId}`,{id:playerId,name:myName,status:"queued",hb:Date.now()});
    setQuickQueue(true);setBusy(false);
  };
  const leaveQuickMatch=async()=>{
    const q=await sget("dp:qm:queue");
    if(q&&q.id===playerId)await sdel("dp:qm:queue");
    await sset(`dp:pl:${playerId}`,{id:playerId,name:myName,status:"online",hb:Date.now()});
    setQuickQueue(false);
  };
  const createRoom=async()=>{
    setBusy(true);setErr("");
    const code=genCode();
    await sset(`dp:room:${code}`,{board:initBoard(),current:"red",log:["Waiting for opponent…"],winner:null,capRed:0,capBlack:0,moveCount:0,players:{red:playerId,black:null},names:{red:myName,black:"?"},version:0});
    await sset(`dp:pl:${playerId}`,{id:playerId,name:myName,status:"waiting",hb:Date.now()});
    setBusy(false);onStartGame(code,"red",myName,null);
  };
  const joinRoom=async()=>{
    const c=joinCode.trim().toUpperCase();
    if(c.length<5){setErr("Enter a valid room code.");return;}
    setBusy(true);setErr("");
    const room=await sget(`dp:room:${c}`);
    if(!room){setErr("Room not found. Check the code.");setBusy(false);return;}
    if(room.players.black!==null&&room.players.black!==undefined){setErr("Room is full!");setBusy(false);return;}
    room.players.black=playerId;room.names.black=myName;
    room.log=[`⚡ ${myName} joined as Black!`,...room.log];
    room.version=(room.version||0)+1;
    await sset(`dp:room:${c}`,room);
    await sset(`dp:pl:${playerId}`,{id:playerId,name:myName,status:"ingame",hb:Date.now()});
    setBusy(false);onStartGame(c,"black",myName,room.names.red);
  };

  const TABS=[{id:"find",label:"🌐 Find Players"},{id:"quick",label:"⚡ Quick Match"},{id:"code",label:"🔗 Room Code"},{id:"local",label:"🖥 Local"}];

  return(
    <Screen center={false}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:640,margin:"0 auto"}}>
        <Title sub={`Welcome, ${myName}!`}/>

        {/* Profile bar */}
        <div style={{width:"100%",marginBottom:16,padding:"12px 18px",background:"#18120a",border:"1px solid #2a1808",borderRadius:10,display:"flex",alignItems:"center",gap:14}}>
          <Avatar name={myName} size={42}/>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:"bold",color:"#e8dcc8"}}>{myName}</div>
            {session&&<div style={{fontSize:11,color:"#5a4a28",marginTop:3,display:"flex",gap:12}}>
              <span style={{color:"#3a7a30"}}>🏆 {session.wins||0} wins</span>
              <span style={{color:"#7a3a28"}}>💀 {session.losses||0} losses</span>
              <span style={{color:"#4a4a28"}}>🎮 {session.gamesPlayed||0} played</span>
            </div>}
          </div>
          <Btn variant="ghost" onClick={onLogout} style={{padding:"6px 14px",fontSize:11}}>🚪 Log Out</Btn>
        </div>

        {pendingIn&&(
          <div style={{width:"100%",marginBottom:16,padding:"18px 22px",background:"linear-gradient(135deg,rgba(212,168,75,0.14),rgba(140,80,10,0.1))",border:"2px solid #c8982a",borderRadius:12,boxShadow:"0 0 30px rgba(212,168,75,0.18)"}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <Avatar name={pendingIn.fromName} size={48}/>
              <div style={{flex:1}}>
                <div style={{color:GOLD,fontWeight:"bold",fontSize:15,marginBottom:3}}>⚔ Challenge Received!</div>
                <div style={{color:"#a89050",fontSize:13}}><strong style={{color:"#e8dcc8"}}>{pendingIn.fromName}</strong> wants to play Draft Pesa!</div>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <Btn variant="green" onClick={acceptChallenge} style={{padding:"8px 16px",fontSize:12}}>✅ Accept</Btn>
                <Btn variant="danger" onClick={declineChallenge} style={{padding:"8px 14px",fontSize:12}}>✕ Decline</Btn>
              </div>
            </div>
          </div>
        )}

        {pendingOut&&(
          <div style={{width:"100%",marginBottom:12,padding:"10px 18px",background:"rgba(80,60,10,0.25)",border:"1px solid #5a4010",borderRadius:8,display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:16}}>⏳</div>
            <div style={{flex:1,fontSize:13,color:"#c8a030"}}>Waiting for <strong style={{color:"#e8dcc8"}}>{pendingOut.toName}</strong> to accept…</div>
            <Btn variant="ghost" onClick={cancelChallenge} style={{padding:"5px 12px",fontSize:11}}>Cancel</Btn>
          </div>
        )}

        {quickQueue&&(
          <div style={{width:"100%",marginBottom:12,padding:"12px 18px",background:"linear-gradient(135deg,rgba(30,80,30,0.3),rgba(20,60,20,0.2))",border:"1px solid #2a6020",borderRadius:8,display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:20}}>🔍</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,color:"#6ad060",fontWeight:"bold"}}>Searching for an opponent…</div>
              <div style={{fontSize:11,color:"#3a6030",marginTop:2}}>You'll be matched automatically when someone joins the queue</div>
            </div>
            <Btn variant="danger" onClick={leaveQuickMatch} style={{padding:"6px 14px",fontSize:11}}>Leave Queue</Btn>
          </div>
        )}

        {notice&&<div style={{width:"100%",marginBottom:10,padding:"8px 16px",background:"rgba(80,60,10,0.2)",border:"1px solid #4a3010",borderRadius:6,color:"#c8a030",fontSize:12,textAlign:"center"}}>{notice}</div>}

        <div style={{display:"flex",width:"100%",borderBottom:"1px solid #1a1208",marginBottom:20}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setErr("");}}
              style={{flex:1,padding:"10px 4px",background:"transparent",border:"none",borderBottom:tab===t.id?`2px solid ${GOLD}`:"2px solid transparent",color:tab===t.id?GOLD:"#3a2a12",cursor:"pointer",fontSize:11,letterSpacing:0.5,fontFamily:F,marginBottom:-1,whiteSpace:"nowrap"}}>
              {t.label}
            </button>
          ))}
        </div>

        {tab==="find"&&<FindTab players={players} onlineCount={onlineCount} myName={myName} pendingOut={pendingOut} pendingIn={pendingIn} onChallenge={sendChallenge}/>}
        {tab==="quick"&&<QuickTab inQueue={quickQueue} busy={busy} onJoin={joinQuickMatch} onLeave={leaveQuickMatch} onlineCount={onlineCount}/>}

        {tab==="code"&&(
          <Card style={{width:"100%"}}>
            <div style={{marginBottom:22}}>
              <div style={{fontSize:11,letterSpacing:3,color:"#4a3a18",marginBottom:8,textAlign:"center"}}>CREATE A PRIVATE ROOM</div>
              <p style={{fontSize:12,color:"#5a4a28",textAlign:"center",margin:"0 0 14px",lineHeight:1.8}}>Get a 6-letter code to share with a specific friend</p>
              <Btn onClick={createRoom} disabled={busy} style={{width:"100%",padding:"13px"}}>{busy?"Creating…":"✨ Create Private Room"}</Btn>
            </div>
            <div style={{borderTop:"1px solid #1e1408",paddingTop:20}}>
              <div style={{fontSize:11,letterSpacing:3,color:"#4a3a18",marginBottom:8,textAlign:"center"}}>JOIN WITH A CODE</div>
              <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&joinRoom()} maxLength={6} placeholder="A B C D E F"
                style={{width:"100%",padding:"13px",textAlign:"center",fontSize:26,letterSpacing:12,background:"#0f0b07",color:GOLD,border:"2px solid #3a2610",borderRadius:6,outline:"none",fontFamily:"monospace",boxSizing:"border-box",marginBottom:10}}/>
              {err&&<div style={{color:"#c06040",fontSize:12,marginBottom:8,textAlign:"center"}}>{err}</div>}
              <Btn onClick={joinRoom} disabled={busy||joinCode.length<5} style={{width:"100%",padding:"12px"}}>{busy?"Joining…":"🚀 Join Room"}</Btn>
            </div>
          </Card>
        )}

        {tab==="local"&&(
          <Card style={{width:"100%",textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:12}}>🖥</div>
            <div style={{color:GOLD,fontSize:15,marginBottom:6,letterSpacing:1}}>LOCAL 2-PLAYER</div>
            <div style={{color:"#5a4a28",fontSize:13,lineHeight:1.9,marginBottom:22}}>Both players share one screen.<br/>Take turns on the same device.</div>
            <Btn onClick={()=>onStartGame(null,"local",myName,"Player 2")} style={{padding:"13px 40px"}}>START LOCAL GAME</Btn>
          </Card>
        )}

        <div style={{marginTop:18,fontSize:10,color:"#2a1a08",textAlign:"center",lineHeight:1.8}}>
          <span style={{color:"#3a6a2a"}}>● {onlineCount} player{onlineCount!==1?"s":""} online now</span>{" · "}Your name is visible to others
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </Screen>
  );
}

// ── Find Players Tab ──────────────────────────────────────────────────────────
function FindTab({players,onlineCount,myName,pendingOut,pendingIn,onChallenge}){
  const [filter,setFilter]=useState("all");
  const available=players.filter(p=>p.status==="online");
  const inGame=players.filter(p=>p.status==="ingame"||p.status==="waiting");
  const shown=filter==="available"?available:filter==="ingame"?inGame:players;

  return(
    <div style={{width:"100%"}}>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[{id:"all",label:`All (${players.length})`},{id:"available",label:`🟢 Available (${available.length})`},{id:"ingame",label:`🟡 In Game (${inGame.length})`}].map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)}
            style={{padding:"5px 12px",fontSize:11,background:filter===f.id?"#2a1a08":"transparent",color:filter===f.id?GOLD:"#3a2a12",border:`1px solid ${filter===f.id?"#4a3010":"#1a1208"}`,borderRadius:20,cursor:"pointer",fontFamily:F}}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length===0?(
        <div style={{textAlign:"center",padding:"52px 20px",border:"1px dashed #1e1408",borderRadius:10}}>
          <div style={{fontSize:36,marginBottom:14}}>🌐</div>
          <div style={{color:"#4a3a18",fontSize:14,marginBottom:8}}>{players.length===0?"No players online right now":"No players in this filter"}</div>
          <div style={{color:"#2a1a0c",fontSize:12,lineHeight:1.9}}>
            {players.length===0?<>Share this game with friends — they'll appear here automatically.<br/>Or try <span style={{color:"#7a6020"}}>⚡ Quick Match</span> to get paired with anyone.</>:"Switch to 'All' to see everyone"}
          </div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {shown.map(p=>{
            const challenged=pendingOut?.toId===p.id;
            const busy2=p.status==="ingame"||p.status==="queued";
            const canChallenge=!busy2&&!pendingOut&&!pendingIn;
            return(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"#18120a",border:`1px solid ${challenged?"#6a5010":"#221808"}`,borderRadius:10,transition:"border-color 0.2s"}}>
                <Avatar name={p.name} size={44}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,color:"#e8dcc8",fontWeight:"bold",marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    {p.status==="online"&&<Badge color="#3a8a3a">🟢 Available</Badge>}
                    {p.status==="ingame"&&<Badge color="#8a6a18">🟡 In a game</Badge>}
                    {p.status==="queued"&&<Badge color="#4a6a8a">🔵 In queue</Badge>}
                    {p.status==="waiting"&&<Badge color="#6a4a8a">🟣 Waiting</Badge>}
                  </div>
                </div>
                {challenged?(
                  <div style={{fontSize:12,color:"#a08030",flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:"#c89020",display:"inline-block",animation:"pulse 1s infinite"}}/>Pending…
                  </div>
                ):(
                  <Btn onClick={()=>canChallenge&&onChallenge(p)} disabled={!canChallenge} variant={canChallenge?"primary":"ghost"} style={{padding:"8px 16px",fontSize:12,flexShrink:0}}>
                    {busy2?"🎮 Busy":"⚔ Challenge"}
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div style={{marginTop:14,padding:"10px 14px",background:"rgba(212,168,75,0.03)",border:"1px solid #1a1208",borderRadius:6,fontSize:11,color:"#2a1a0c",lineHeight:1.8,textAlign:"center"}}>
        Your name <strong style={{color:"#4a3818"}}>{myName}</strong> is visible to others · Challenges expire in 30 seconds
      </div>
    </div>
  );
}

// ── Quick Match Tab ───────────────────────────────────────────────────────────
function QuickTab({inQueue,busy,onJoin,onLeave,onlineCount}){
  const [dots,setDots]=useState(".");
  useEffect(()=>{if(!inQueue)return;const t=setInterval(()=>setDots(d=>d.length>=3?".":d+"."),500);return()=>clearInterval(t);},[inQueue]);
  return(
    <Card style={{width:"100%",textAlign:"center"}}>
      {!inQueue?(
        <>
          <div style={{fontSize:44,marginBottom:14}}>⚡</div>
          <div style={{color:GOLD,fontSize:16,marginBottom:6,letterSpacing:2}}>QUICK MATCH</div>
          <div style={{color:"#5a4a28",fontSize:13,lineHeight:2,marginBottom:24}}>
            Jump straight into a game — no friends needed.<br/>
            You'll be automatically paired with another player<br/>who is also looking for a game right now.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:20}}>
            {[{icon:"⚡",label:"Instant pairing",sub:"Matched automatically",col:"#5ab050"},{icon:"🌍",label:"Anyone online",sub:"Meet new players",col:"#5060c0"},{icon:"🎲",label:"Random color",sub:"Red or Black",col:"#c09030"}].map(f=>(
              <div key={f.icon} style={{padding:"10px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid #1a1408",borderRadius:8,flex:1}}>
                <div style={{fontSize:22,marginBottom:4}}>{f.icon}</div>
                <div style={{fontSize:11,color:f.col,fontWeight:"bold"}}>{f.label}</div>
                <div style={{fontSize:10,color:"#3a2a10",marginTop:2}}>{f.sub}</div>
              </div>
            ))}
          </div>
          {onlineCount>0&&<div style={{fontSize:12,color:"#3a6a28",marginBottom:14}}>● {onlineCount} player{onlineCount!==1?"s":""} online right now</div>}
          <Btn onClick={onJoin} disabled={busy} style={{padding:"14px 48px",fontSize:14}}>{busy?"Searching…":"🔍 Find a Game"}</Btn>
          <div style={{fontSize:11,color:"#2a1e0c",marginTop:14,lineHeight:1.7}}>
            If no one is queued, you'll wait — the next player who clicks "Find a Game" gets matched with you instantly.
          </div>
        </>
      ):(
        <>
          <div style={{fontSize:44,marginBottom:14,display:"inline-block"}}>🔍</div>
          <div style={{color:"#6ad060",fontSize:16,marginBottom:6,letterSpacing:2}}>SEARCHING{dots}</div>
          <div style={{color:"#3a5a30",fontSize:13,lineHeight:1.9,marginBottom:20}}>
            You're in the queue. The next player who<br/>clicks "Find a Game" will be matched with you.
          </div>
          <div style={{padding:"12px 20px",background:"rgba(30,60,30,0.2)",border:"1px solid #2a4a20",borderRadius:8,marginBottom:20}}>
            <div style={{fontSize:11,color:"#4a7a40",letterSpacing:2,marginBottom:4}}>STATUS</div>
            <div style={{fontSize:13,color:"#70c060"}}>● Waiting for opponent…</div>
          </div>
          <Btn variant="danger" onClick={onLeave} style={{padding:"10px 28px"}}>Leave Queue</Btn>
        </>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GAME
// ══════════════════════════════════════════════════════════════════════════════
function Game({roomCode,myColor,myName,opName,onLeave}){
  const online=myColor!=="local";
  const [board,setBoard]=useState(initBoard);
  const [cur,setCur]=useState("red");
  const [sel,setSel]=useState(null);
  const [valid,setValid]=useState([]);
  const [mustJ,setMustJ]=useState(false);
  const [chain,setChain]=useState(null);
  const [log,setLog]=useState(online?[]:[`Local game started! Red moves first.`]);
  const [win,setWin]=useState(null);
  const [capR,setCapR]=useState(0);
  const [capB,setCapB]=useState(0);
  const [lastMv,setLastMv]=useState(null);
  const [rules,setRules]=useState(false);
  const [moves,setMoves]=useState(0);
  const [kings,setKings]=useState({red:0,black:0});
  const [oppOnline,setOppOnline]=useState(!!opName);
  const [sync,setSync]=useState(online?"syncing":"ok");
  const [names,setNames]=useState({red:myColor==="red"?myName:(opName||"Red"),black:myColor==="black"?myName:(opName||"Black")});
  const ver=useRef(0);
  const [cs,setCs]=useState(58);

  useEffect(()=>{const f=()=>setCs(Math.max(32,Math.min(68,Math.floor((window.innerWidth-260)/8),Math.floor((window.innerHeight-180)/8))));f();window.addEventListener("resize",f);return()=>window.removeEventListener("resize",f);},[]);
  useEffect(()=>{let rk=0,bk=0;for(let r=0;r<8;r++)for(let c=0;c<8;c++){if(board[r][c]===RED_KING)rk++;if(board[r][c]===BLACK_KING)bk++;}setKings({red:rk,black:bk});},[board]);
  useEffect(()=>{if(win)return;if(allMoves(board,cur).length===0){const w=opp(cur);setWin(w);setLog(l=>[`🏆 ${names[w]} WINS!`,...l].slice(0,40));}},[board,cur,win]);

  useEffect(()=>{
    if(!online)return;
    const poll=async()=>{
      const r=await sget(`dp:room:${roomCode}`);
      if(!r){setSync("error");return;}
      setSync("ok");
      if(r.names)setNames(r.names);
      setOppOnline(r.players&&r.players[opp(myColor)]!==null&&r.players[opp(myColor)]!==undefined);
      if((r.version||0)>ver.current){
        ver.current=r.version||0;
        setBoard(r.board);setCur(r.current);setLog(r.log||[]);
        setCapR(r.capRed||0);setCapB(r.capBlack||0);setMoves(r.moveCount||0);
        if(r.winner)setWin(r.winner);
        setSel(null);setValid([]);setChain(null);
      }
    };
    poll();const t=setInterval(poll,POLL_MS);return()=>clearInterval(t);
  },[online,roomCode,myColor]);

  const push=useCallback(async extra=>{
    if(!online)return;
    const r=await sget(`dp:room:${roomCode}`);if(!r)return;
    const nv=(r.version||0)+1;ver.current=nv;
    await sset(`dp:room:${roomCode}`,{...r,...extra,version:nv});
  },[online,roomCode]);

  const myTurn=myColor==="local"?true:cur===myColor;
  const tgts=new Set(valid.map(m=>`${m.to[0]}-${m.to[1]}`));
  const ctgts=new Set(valid.filter(m=>m.over).map(m=>`${m.to[0]}-${m.to[1]}`));
  const{red:rp,black:bp}=countP(board);

  const click=useCallback((r,c)=>{
    if(win||!myTurn)return;
    const ap=myColor==="local"?cur:myColor;
    const piece=board[r][c];
    if(chain){
      const[cr,cc]=chain;
      if(r===cr&&c===cc){setSel([r,c]);setValid(getJumps(board,cr,cc,ap));return;}
      const mv=valid.find(m=>m.to[0]===r&&m.to[1]===c);if(mv)exec(mv,ap);return;
    }
    const hj=allJumps(board,ap).length>0;setMustJ(hj);
    if(belongs(piece,ap)){setSel([r,c]);setValid(hj?getJumps(board,r,c,ap):getMoves(board,r,c,ap));return;}
    if(sel){const mv=valid.find(m=>m.to[0]===r&&m.to[1]===c);if(mv){exec(mv,ap);return;}}
    setSel(null);setValid([]);
  },[board,cur,myColor,myTurn,sel,valid,chain,win]);

  const exec=useCallback((mv,ap)=>{
    const nb=applyMove(board,mv);
    const[tr,tc]=mv.to,piece=nb[tr][tc];
    const pn=names[ap]||(ap==="red"?"Red":"Black");
    let msg=`${ap==="red"?"🔴":"⚫"} ${pn}: (${mv.from[0]},${mv.from[1]})→(${tr},${tc})`;
    let nr=capR,nb2=capB;
    if(mv.over){msg+=" ⚔";if(ap==="red")nb2=capB+1;else nr=capR+1;}
    const wasK=(ap==="red"&&board[mv.from[0]][mv.from[1]]===RED_KING)||(ap==="black"&&board[mv.from[0]][mv.from[1]]===BLACK_KING);
    if(!wasK&&(piece===RED_KING||piece===BLACK_KING))msg+=" 👑 KING!";
    const nl=[msg,...log].slice(0,40);const nm=moves+1;
    if(mv.over){
      const fj=getJumps(nb,tr,tc,ap);
      const jc=(ap==="red"&&tr===0&&board[mv.from[0]][mv.from[1]]===RED)||(ap==="black"&&tr===7&&board[mv.from[0]][mv.from[1]]===BLACK);
      if(fj.length>0&&!jc){
        const cl=[`${pn} continues!`,...nl].slice(0,40);
        setBoard(nb);setLastMv(mv);setMoves(nm);setLog(cl);setCapR(nr);setCapB(nb2);
        setChain([tr,tc]);setSel([tr,tc]);setValid(fj);
        if(online)push({board:nb,current:cur,log:cl,capRed:nr,capBlack:nb2,moveCount:nm});return;
      }
    }
    const nc=opp(ap);
    setBoard(nb);setLastMv(mv);setMoves(nm);setLog(nl);setCapR(nr);setCapB(nb2);
    setCur(nc);setChain(null);setSel(null);setValid([]);
    if(online)push({board:nb,current:nc,log:nl,capRed:nr,capBlack:nb2,moveCount:nm});
  },[board,cur,log,capR,capB,moves,online,push,names]);

  const reset=async()=>{
    const f={board:initBoard(),current:"red",log:[`New game! ${names.red} vs ${names.black}.`],winner:null,capRed:0,capBlack:0,moveCount:0};
    setBoard(f.board);setCur("red");setSel(null);setValid([]);setMustJ(false);setChain(null);
    setLog(f.log);setWin(null);setCapR(0);setCapB(0);setLastMv(null);setMoves(0);
    if(online&&roomCode){const r=await sget(`dp:room:${roomCode}`);await sset(`dp:room:${roomCode}`,{...f,version:(r?.version||0)+1});}
  };

  return(
    <div style={{minHeight:"100vh",maxHeight:"100vh",overflow:"auto",background:"#0e0b08",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:F,color:"#e8dcc8",padding:"10px 12px",userSelect:"none",boxSizing:"border-box"}}>
      <div style={{textAlign:"center",marginBottom:6,position:"relative",width:"100%",maxWidth:820}}>
        <div style={{fontSize:9,letterSpacing:5,color:"#2a1a08",marginBottom:2}}>THE ROYAL GAME OF</div>
        <h1 style={{margin:0,fontSize:24,fontWeight:"normal",color:GOLD,letterSpacing:4,textShadow:"0 0 30px rgba(212,168,75,0.3)"}}>DRAFT PESA</h1>
        <div style={{fontSize:10,color:"#2a1a08",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:3}}>
          {online&&<><span style={{color:"#3a5a28"}}>Room: <span style={{fontFamily:"monospace",letterSpacing:2,color:"#5a8040"}}>{roomCode}</span></span><span>·</span><span style={{color:oppOnline?"#3a8a3a":"#6a3820"}}>{oppOnline?`${names[opp(myColor)]} ●`:"Waiting…"}</span><span>·</span><span style={{color:sync==="ok"?"#2a5a28":"#7a3a18"}}>{sync==="ok"?"✓ Live":"⟳"}</span></>}
          {!online&&<span>LOCAL 2-PLAYER</span>}
        </div>
        <button onClick={onLeave} style={{position:"absolute",right:0,top:0,background:"transparent",border:"1px solid #1e1408",color:"#2a1e0c",borderRadius:4,padding:"4px 10px",cursor:"pointer",fontSize:10,fontFamily:F}}>✕ Lobby</button>
      </div>

      {online&&<div style={{marginBottom:4,padding:"4px 14px",background:"rgba(212,168,75,0.04)",border:"1px solid #1a1208",borderRadius:20,fontSize:11,color:"#4a3a18",display:"flex",alignItems:"center",gap:6}}>
        You: <strong style={{color:myColor==="red"?"#e8614a":"#ccc",marginLeft:2}}>{myColor==="red"?"🔴":"⚫"} {myName}</strong>
        {!myTurn&&!win&&<span style={{color:"#2a1e0c"}}>· Waiting for {names[opp(myColor)]}…</span>}
        {myTurn&&!win&&<span style={{color:"#4a7a28"}}>· Your turn ▶</span>}
      </div>}

      {!win&&<div style={{marginBottom:6,padding:"5px 16px",background:cur==="red"?"rgba(140,30,10,0.25)":"rgba(20,20,20,0.7)",border:`1px solid ${cur==="red"?"#803010":"#2a2a2a"}`,borderRadius:28,fontSize:12,letterSpacing:2,color:cur==="red"?"#c06050":"#999",display:"flex",alignItems:"center",gap:8}}>
        {cur==="red"?"🔴":"⚫"}<strong>{names[cur]}'s turn</strong>
        {mustJ&&!chain&&<span style={{color:"#c08820",fontSize:10}}>⚠ MUST CAPTURE</span>}
        {chain&&<span style={{color:"#c08820",fontSize:10}}>⚡ CHAIN!</span>}
      </div>}

      {win&&<div style={{marginBottom:10,padding:"10px 28px",background:win==="red"?"rgba(140,30,10,0.4)":"rgba(15,15,25,0.9)",border:"2px solid #d4a84b",borderRadius:8,textAlign:"center"}}>
        <div style={{fontSize:22,marginBottom:3}}>{win==="red"?"🔴":"⚫"} 👑</div>
        <div style={{fontSize:16,color:GOLD,letterSpacing:3}}>{names[win].toUpperCase()} WINS!</div>
        <div style={{fontSize:11,color:"#444",marginTop:2}}>{moves} moves</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
          <Btn onClick={reset} style={{padding:"6px 18px",fontSize:11}}>🔄 Rematch</Btn>
          <Btn variant="ghost" onClick={onLeave} style={{padding:"6px 18px",fontSize:11}}>← Lobby</Btn>
        </div>
      </div>}

      <div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap",justifyContent:"center"}}>
        <div>
          <div style={{display:"flex",marginLeft:20,marginBottom:2}}>{["A","B","C","D","E","F","G","H"].map(l=><div key={l} style={{width:cs,textAlign:"center",fontSize:9,color:"#2a1a08"}}>{l}</div>)}</div>
          <div style={{display:"flex"}}>
            <div style={{display:"flex",flexDirection:"column"}}>{[8,7,6,5,4,3,2,1].map(n=><div key={n} style={{height:cs,width:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#2a1a08"}}>{n}</div>)}</div>
            <div style={{display:"grid",gridTemplateColumns:`repeat(8,${cs}px)`,gridTemplateRows:`repeat(8,${cs}px)`,border:"3px solid #6b5020",boxShadow:"0 0 40px rgba(0,0,0,0.9)"}}>
              {board.map((row,r)=>row.map((piece,c)=>{
                const dk=(r+c)%2===1,isSel=sel&&sel[0]===r&&sel[1]===c;
                const isTgt=tgts.has(`${r}-${c}`),isCap=ctgts.has(`${r}-${c}`);
                const wasLast=lastMv&&((lastMv.from[0]===r&&lastMv.from[1]===c)||(lastMv.to[0]===r&&lastMv.to[1]===c));
                let bg=dk?"#2c1a0e":"#c4a882";
                if(dk){if(isSel)bg="#5c3a10";else if(wasLast)bg="#3d2510";}
                return(
                  <div key={`${r}-${c}`} onClick={()=>dk&&click(r,c)}
                    style={{width:cs,height:cs,background:bg,display:"flex",alignItems:"center",justifyContent:"center",cursor:dk&&myTurn?"pointer":"default",position:"relative",transition:"background 0.13s",boxSizing:"border-box",border:isSel?"2px solid #d4a84b":"2px solid transparent"}}>
                    {isTgt&&dk&&<div style={{position:"absolute",width:isCap?cs*0.33:cs*0.25,height:isCap?cs*0.33:cs*0.25,borderRadius:"50%",background:isCap?"rgba(240,100,30,0.75)":"rgba(212,168,75,0.6)",boxShadow:isCap?"0 0 10px rgba(240,100,30,0.7)":"none",pointerEvents:"none",zIndex:2}}/>}
                    {piece!==EMPTY&&<Piece type={piece} sel={!!isSel} cs={cs}/>}
                  </div>
                );
              }))}
            </div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,width:Math.max(148,Math.min(200,cs*3)),flexShrink:0}}>
          <div style={{background:"#18120a",border:"1px solid #201408",borderRadius:6,padding:"10px 12px"}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#2a1a08",marginBottom:8}}>PLAYERS</div>
            {[{col:"red",emoji:"🔴",pieces:rp,cap:capB,k:kings.red},{col:"black",emoji:"⚫",pieces:bp,cap:capR,k:kings.black}].map(p=>{
              const act=cur===p.col&&!win,me=online&&myColor===p.col;
              return(
                <div key={p.col} style={{marginBottom:6,padding:"7px 9px",background:act?"rgba(212,168,75,0.07)":"transparent",border:`1px solid ${act?"#4a3408":"#181008"}`,borderRadius:4}}>
                  <div style={{fontWeight:"bold",fontSize:12,marginBottom:3,color:act?GOLD:"#6a5a30",display:"flex",alignItems:"center",gap:4}}>
                    {p.emoji} {names[p.col]}{act?" ◀":""}
                    {me&&<span style={{fontSize:9,color:"#3a7a3a"}}>(you)</span>}
                  </div>
                  <div style={{fontSize:10,color:"#4a3a18",display:"flex",gap:8}}>
                    <span>♟ {p.pieces}</span><span>⚔ {p.cap}</span>{p.k>0&&<span style={{color:GOLD}}>👑{p.k}</span>}
                  </div>
                </div>
              );
            })}
            <div style={{fontSize:9,color:"#2a1a08",textAlign:"right",marginTop:2}}>Move #{moves}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={reset} style={{flex:1,padding:"7px 0",background:"#181008",color:"#b89030",border:"1px solid #281808",borderRadius:4,cursor:"pointer",fontSize:10,fontFamily:F}}>🔄 New</button>
            <button onClick={()=>setRules(x=>!x)} style={{flex:1,padding:"7px 0",background:rules?"#201608":"#141008",color:"#6a5a28",border:"1px solid #181008",borderRadius:4,cursor:"pointer",fontSize:10,fontFamily:F}}>📜 Rules</button>
          </div>
          <div style={{background:"#141008",border:"1px solid #181008",borderRadius:6,padding:"8px 10px",flex:1}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#2a1a08",marginBottom:6}}>MOVE LOG</div>
            <div style={{maxHeight:120,overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
              {log.map((e,i)=><div key={i} style={{fontSize:9,color:i===0?"#a87830":"#2a1a08",borderBottom:"1px solid #141008",paddingBottom:2,lineHeight:1.4}}>{e}</div>)}
            </div>
          </div>
        </div>
      </div>
      {rules&&<div style={{marginTop:12,maxWidth:600,background:"#141008",border:"1px solid #201408",borderRadius:8,padding:"14px 18px"}}>
        <h2 style={{color:GOLD,marginTop:0,fontSize:13,letterSpacing:3,fontWeight:"normal"}}>📜 RULES</h2>
        {[["🎯 Win","Capture all pieces or leave opponent with no moves."],["➡ Move","Diagonal forward 1 square."],["⚡ Capture","Jump over enemy to empty square beyond."],["🔗 Multi-Jump","Continue if more jumps exist."],["⚠ Mandatory","Must capture if available."],["👑 Flying King","Slides & jumps any distance diagonally."],["🚫 Crown Stop","Crowned piece can't jump further that turn."]].map(([t,d])=>(
          <div key={t} style={{marginBottom:7,display:"flex",gap:10}}>
            <div style={{minWidth:130,fontSize:11,color:"#c8a040"}}>{t}</div>
            <div style={{fontSize:11,color:"#5a4a20",lineHeight:1.5}}>{d}</div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [session,setSession]=useState(null);
  const [screen,setScreen]=useState("auth");
  const [gp,setGp]=useState(null);
  const onAuth=s=>{setSession(s);setScreen("lobby");};
  const start=(roomCode,myColor,myName2,opName)=>{setGp({roomCode,myColor,myName:myName2,opName});setScreen("game");};
  const back=()=>{setGp(null);setScreen("lobby");};
  const logout=()=>{try{localStorage.removeItem("dp_session");}catch{}setSession(null);setScreen("auth");};
  if(screen==="auth")return <AuthGate onDone={onAuth}/>;
  if(screen==="game"&&gp)return <Game {...gp} onLeave={back}/>;
  return <Lobby myName={session?.username||"Player"} onStartGame={start} onLogout={logout} session={session}/>;
}