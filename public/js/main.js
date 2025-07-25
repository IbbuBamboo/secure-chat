const socket = io();

// Get name and room from URL
const urlParams = new URLSearchParams(window.location.search);
const userName = urlParams.get("name") || "Guest";
const roomId = urlParams.get("room") || "default-room";

// DOM
const videoGrid = document.getElementById("video-grid");

// WebRTC
const peers = {};
let localStream = null;

// 1. Join Room
socket.emit("join-room", { roomId, userName });

// 2. Get Camera + Mic
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    addUserTile(userName, stream, true);
    setupSocketEvents(stream);
  })
  .catch(err => {
    console.warn("Could not access camera/mic. Using avatar instead.");
    addUserTile(userName, null, true);
    setupSocketEvents(null);
  });

// 3. Socket Events
function setupSocketEvents(stream) {
  socket.on("existing-users", users => {
    users.forEach(user => {
      connectToUser(user.id, user.name, stream);
    });
  });

  socket.on("user-joined", ({ id, name }) => {
    connectToUser(id, name, stream);
  });

  socket.on("signal", async ({ from, sdp, candidate, name }) => {
    let peer = peers[from];
    if (!peer) {
      peer = createPeer(from, name, false);
    }

    if (sdp) {
      await peer.setRemoteDescription(new RTCSessionDescription(sdp));
      if (sdp.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("signal", {
          to: from,
          sdp: peer.localDescription,
          from: socket.id,
          name: userName
        });
      }
    }

    if (candidate) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });

  socket.on("user-left", id => {
    if (peers[id]) peers[id].close();
    delete peers[id];
    removeUserTile(id);
  });
}

// 4. Connect to User
function connectToUser(socketId, name, stream) {
  const peer = createPeer(socketId, name, true);
  peers[socketId] = peer;

  if (stream) {
    stream.getTracks().forEach(track => peer.addTrack(track, stream));
  }
}

// 5. Create Peer
function createPeer(id, name, isInitiator) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  const remoteStream = new MediaStream();

  peer.ontrack = event => {
    remoteStream.addTrack(event.track);
  };

  peer.onconnectionstatechange = () => {
    if (peer.connectionState === "connected") {
      addUserTile(name, remoteStream, false, id);
    }
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", {
        to: id,
        candidate: e.candidate,
        from: socket.id
      });
    }
  };

  if (isInitiator) {
    peer.createOffer().then(offer => {
      return peer.setLocalDescription(offer);
    }).then(() => {
      socket.emit("signal", {
        to: id,
        sdp: peer.localDescription,
        from: socket.id,
        name: userName
      });
    });
  }

  return peer;
}

// -------------------
// UI Functions
// -------------------
function addUserTile(name, stream, isLocal = false, id = null) {
  const tile = document.createElement("div");
  tile.className = "video-tile";
  tile.id = id ? `tile-${id}` : (isLocal ? "tile-local" : "");

  if (stream) {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = isLocal;
    tile.appendChild(video);
  } else {
    const avatar = document.createElement("div");
    avatar.className = "avatar-circle";
    avatar.textContent = name[0].toUpperCase();
    tile.appendChild(avatar);
  }

  const label = document.createElement("div");
  label.className = "video-name";
  label.textContent = name;
  tile.appendChild(label);

  videoGrid.appendChild(tile);
}

function removeUserTile(id) {
  const el = document.getElementById(`tile-${id}`);
  if (el) el.remove();
}
