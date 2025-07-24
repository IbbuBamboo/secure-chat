const socket = io();

// Get user info from URL
const urlParams = new URLSearchParams(window.location.search);
const userName = urlParams.get("name") || "Guest";
const roomId = urlParams.get("room") || "default-room";

// DOM
const videoGrid = document.getElementById("video-grid");

// Globals
const peers = {};
let localStream = null;

// 1. Get local camera + mic
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    createUserTile(userName, stream, true);

    // Join room after getting stream
    socket.emit("join-room", { roomId, userName });

    // Handle existing users
    socket.on("existing-users", (users) => {
      users.forEach(user => {
        setupPeer(user.id, user.name, true);
      });
    });

    // Handle new user
    socket.on("user-joined", ({ id, name }) => {
      setupPeer(id, name, true);
    });

    // Handle signaling
    socket.on("signal", async ({ from, description, candidate, name }) => {
      let peer = peers[from];
      if (!peer) {
        peer = setupPeer(from, name, false);
      }

      if (description) {
        await peer.setRemoteDescription(new RTCSessionDescription(description));
        if (description.type === "offer") {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit("signal", {
            to: from,
            description: peer.localDescription
          });
        }
      }

      if (candidate) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("ICE error:", err);
        }
      }
    });

    // Handle user leaving
    socket.on("user-left", id => {
      if (peers[id]) peers[id].close();
      delete peers[id];
      removeUserTile(id);
    });

  }).catch(err => {
    console.error("Media error:", err);
    createUserTile(userName, null, true); // fallback avatar
    socket.emit("join-room", { roomId, userName });
  });


// Setup Peer Connection
function setupPeer(peerId, peerName, isInitiator) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peers[peerId] = pc;

  // Send local stream
  localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));

  // Receive remote stream
  const remoteStream = new MediaStream();
  pc.ontrack = event => {
    remoteStream.addTrack(event.track);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      createUserTile(peerName, remoteStream, false, peerId);
    }
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { to: peerId, candidate: e.candidate });
    }
  };

  // Start offer
  if (isInitiator) {
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit("signal", {
        to: peerId,
        description: offer
      });
    });
  }

  return pc;
}


// ----------------------------
// UI HELPERS
// ----------------------------

function createUserTile(name, stream = null, isLocal = false, id = name) {
  const tile = document.createElement("div");
  tile.className = "video-tile";
  tile.dataset.username = id;

  if (stream) {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    if (isLocal) video.muted = true;
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

function removeUserTile(idOrName) {
  const tiles = document.querySelectorAll(".video-tile");
  tiles.forEach(tile => {
    if (tile.dataset.username === idOrName) tile.remove();
  });
}
