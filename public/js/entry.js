// /public/js/entry.js

function generateRoomID() {
  // Simple random alphanumeric ID (6 chars)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'room-' + id;
}

document.getElementById('create-btn').addEventListener('click', () => {
  const name = document.getElementById('create-name').value.trim();
  if (!name) return alert('Please enter your name');
  
  const roomID = generateRoomID();
  window.location.href = `chat.html?room=${roomID}&name=${encodeURIComponent(name)}`;
});

document.getElementById('join-btn').addEventListener('click', () => {
  const name = document.getElementById('join-name').value.trim();
  const room = document.getElementById('join-room').value.trim();
  if (!name || !room) return alert('Please enter both your name and room ID');

  window.location.href = `chat.html?room=${room}&name=${encodeURIComponent(name)}`;
});
