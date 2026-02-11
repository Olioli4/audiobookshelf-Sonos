/**
 * Sonos HTTP API Test Script
 * Interactive CLI to discover and control Sonos speakers
 */

const http = require('http');
const readline = require('readline');

const API_HOST = 'localhost';
const API_PORT = 5005;

// Helper to make HTTP requests to the Sonos API
function apiRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `http://${API_HOST}:${API_PORT}${path}`;
    console.log(`\n→ Requesting: ${url}`);
    
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// Discover all zones/speakers
async function discoverSpeakers() {
  console.log('\n🔍 Discovering Sonos speakers...');
  const zones = await apiRequest('/zones');
  
  const speakers = [];
  for (const zone of zones) {
    for (const member of zone.members) {
      speakers.push({
        name: member.roomName,
        uuid: member.uuid,
        coordinator: zone.coordinator.roomName,
        state: member.state?.playbackState || 'unknown'
      });
    }
  }
  return speakers;
}

// Display speaker list
function displaySpeakers(speakers) {
  console.log('\n📻 Available Speakers:');
  console.log('─'.repeat(50));
  speakers.forEach((speaker, i) => {
    const coordInfo = speaker.name === speaker.coordinator ? ' (coordinator)' : ` → grouped with ${speaker.coordinator}`;
    console.log(`  ${i + 1}. ${speaker.name}${coordInfo}`);
  });
  console.log('─'.repeat(50));
}

// Display available actions
function displayActions() {
  console.log('\n🎵 Available Actions:');
  console.log('─'.repeat(50));
  console.log('  1. play       - Start playback');
  console.log('  2. pause      - Pause playback');
  console.log('  3. volume     - Set volume (0-100)');
  console.log('  4. state      - Get current state');
  console.log('  5. say        - Text-to-speech');
  console.log('  6. next       - Next track');
  console.log('  7. previous   - Previous track');
  console.log('  8. favorites  - List favorites');
  console.log('  9. favorite   - Play a favorite');
  console.log('  10. mute      - Mute speaker');
  console.log('  11. unmute    - Unmute speaker');
  console.log('  12. queue     - View current queue');
  console.log('  13. clearqueue- Clear the queue');
  console.log('  14. playlist  - Play a Sonos playlist');
  console.log('  15. clip      - Play audio clip (from static/clips/)');
  console.log('  16. stream    - Play audio URL/stream');
  console.log('  0. back       - Select different speaker');
  console.log('  q. quit       - Exit');
  console.log('─'.repeat(50));
}

// Control a speaker
async function controlSpeaker(speakerName) {
  const encodedName = encodeURIComponent(speakerName);
  
  while (true) {
    displayActions();
    const choice = await prompt(`\n[${speakerName}] Enter action: `);
    
    try {
      switch (choice.toLowerCase()) {
        case '1':
        case 'play':
          console.log(await apiRequest(`/${encodedName}/play`));
          break;
          
        case '2':
        case 'pause':
          console.log(await apiRequest(`/${encodedName}/pause`));
          break;
          
        case '3':
        case 'volume':
          const vol = await prompt('Enter volume (0-100): ');
          console.log(await apiRequest(`/${encodedName}/volume/${vol}`));
          break;
          
        case '4':
        case 'state':
          const state = await apiRequest(`/${encodedName}/state`);
          console.log('\n📊 Current State:');
          console.log(`  Playing: ${state.playbackState}`);
          console.log(`  Volume: ${state.volume}`);
          console.log(`  Muted: ${state.mute}`);
          if (state.currentTrack) {
            console.log(`  Track: ${state.currentTrack.title || 'N/A'}`);
            console.log(`  Artist: ${state.currentTrack.artist || 'N/A'}`);
          }
          break;
          
        case '5':
        case 'say':
          const text = await prompt('Enter text to speak: ');
          const encodedText = encodeURIComponent(text);
          console.log(await apiRequest(`/${encodedName}/say/${encodedText}`));
          break;
          
        case '6':
        case 'next':
          console.log(await apiRequest(`/${encodedName}/next`));
          break;
          
        case '7':
        case 'previous':
          console.log(await apiRequest(`/${encodedName}/previous`));
          break;
          
        case '8':
        case 'favorites':
          const favs = await apiRequest(`/${encodedName}/favorites`);
          console.log('\n⭐ Favorites:');
          if (Array.isArray(favs)) {
            favs.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
          } else {
            console.log(favs);
          }
          break;
          
        case '9':
        case 'favorite':
          const favName = await prompt('Enter favorite name: ');
          const encodedFav = encodeURIComponent(favName);
          console.log(await apiRequest(`/${encodedName}/favorite/${encodedFav}`));
          break;
          
        case '10':
        case 'mute':
          console.log(await apiRequest(`/${encodedName}/mute`));
          break;
          
        case '11':
        case 'unmute':
          console.log(await apiRequest(`/${encodedName}/unmute`));
          break;
          
        case '12':
        case 'queue':
          const queueItems = await apiRequest(`/${encodedName}/queue/20`);
          console.log('\n📋 Current Queue (up to 20 items):');
          if (Array.isArray(queueItems) && queueItems.length > 0) {
            queueItems.forEach((item, i) => {
              console.log(`  ${i + 1}. ${item.title} - ${item.artist}`);
            });
          } else {
            console.log('  Queue is empty');
          }
          break;
          
        case '13':
        case 'clearqueue':
          console.log(await apiRequest(`/${encodedName}/clearqueue`));
          console.log('✓ Queue cleared');
          break;
          
        case '14':
        case 'playlist':
          const playlistName = await prompt('Enter Sonos playlist name: ');
          const encodedPlaylist = encodeURIComponent(playlistName);
          console.log(await apiRequest(`/${encodedName}/playlist/${encodedPlaylist}`));
          break;
          
        case '15':
        case 'clip':
          console.log('\n📁 Place audio files in: static/clips/');
          const clipName = await prompt('Enter clip filename (e.g., announcement.mp3): ');
          const encodedClip = encodeURIComponent(clipName);
          console.log(await apiRequest(`/${encodedName}/clip/${encodedClip}`));
          break;
          
        case '16':
        case 'stream':
          const streamUrl = await prompt('Enter audio URL to stream: ');
          const encodedUrl = encodeURIComponent(streamUrl);
          console.log(await apiRequest(`/${encodedName}/setavtransporturi/${encodedUrl}`));
          break;
          
        case '0':
        case 'back':
          return;
          
        case 'q':
        case 'quit':
          console.log('\n👋 Goodbye!');
          rl.close();
          process.exit(0);
          
        default:
          // Try as raw command
          console.log(await apiRequest(`/${encodedName}/${choice}`));
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Main function
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Sonos HTTP API Test Script          ║');
  console.log('║     Make sure the API server is running ║');
  console.log('╚══════════════════════════════════════════╝');
  
  try {
    while (true) {
      const speakers = await discoverSpeakers();
      
      if (speakers.length === 0) {
        console.log('❌ No speakers found. Make sure Sonos devices are on the network.');
        rl.close();
        return;
      }
      
      displaySpeakers(speakers);
      
      const choice = await prompt('\nSelect speaker (number) or q to quit: ');
      
      if (choice.toLowerCase() === 'q') {
        console.log('\n👋 Goodbye!');
        rl.close();
        return;
      }
      
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < speakers.length) {
        await controlSpeaker(speakers[index].name);
      } else {
        console.log('❌ Invalid selection');
      }
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.log('Make sure the Sonos HTTP API server is running (npm start)');
    rl.close();
  }
}

main();
