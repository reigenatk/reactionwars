const socket = io()

const $announcements = document.querySelector('#announcements')
const $AnnounceTemplate = document.querySelector('#announcement-template').innerHTML
const $player1Username = document.querySelector('#player1_username');
const $player2Username = document.querySelector('#player2_username');
const $rectangle = document.querySelector('#rectangle');

// parse the username + room information in URL params using Qs library
const {username, room} = Qs.parse(location.search, {ignoreQueryPrefix: true})

// this variable is in charge of keeping track of whether or not a round is running
// in the case that both users react early, we need some way to tell the DOM to NOT show the green background
// in the timeout function on line 192
let roundIsRunning;

// this variable helps us target specific announcements when fading
// start with a char since id's arent allowed to start with a number
let announcement_number = 'a0';

// fades out an announcement div given the ID of the div we want to fade
const fade = (div_id) => {
    setTimeout(function() { // start a delay
        var fade = $announcements.querySelector('#' + div_id); // get required element
        fade.style.opacity = 1; // set opacity for the element to 1
        var timerId = setInterval(function() { // start interval loop
          var opacity = fade.style.opacity; // get current opacity
          if (opacity == 0) { // check if its 0 yet
            fade.innerHTML = ''
            clearInterval(timerId); // if so, exit from interval loop
          } else {
            fade.style.opacity = opacity - 0.05; // else remove 0.05 from opacity
          }
        }, 100); // run every 0.1 second
      }, 5000); // wait to run after 5 seconds
}

// some helper functions to toggle various parts of the UI
const readyPlayerOne = () => {
  $('#player1_readystate').html('Ready')
  $('#player1_readybutton').attr('disabled', true)
  $('#player1_readystate').addClass('green');
  $('#player1_readystate').removeClass('red');
}

const readyPlayerTwo = () => {
  $('#player2_readystate').html('Ready')
  $('#player2_readybutton').attr('disabled', true)
  $('#player2_readystate').addClass('green');
  $('#player2_readystate').removeClass('red');
}

const unReadyPlayerOne = () => {
  $('#player1_readystate').html('Not Ready')
  $('#player1_readybutton').attr('disabled', false)
  $('#player1_readystate').addClass('red');
  $('#player1_readystate').removeClass('green');
}

const unReadyPlayerTwo = () => {
  $('#player2_readystate').html('Not Ready')
  $('#player2_readybutton').attr('disabled', false)
  $('#player2_readystate').addClass('red');
  $('#player2_readystate').removeClass('green');
}

const disableP1React = () => {
  $('#player1_reactbutton').attr('disabled', true);
}

const disableP2React = () => {
  $('#player2_reactbutton').attr('disabled', true);
}

const enableP1React = () => {
  $('#player1_reactbutton').attr('disabled', false);
}

const enableP2React = () => {
  $('#player2_reactbutton').attr('disabled', false);
}

const ResetUIForNewRound = () => {
  $('#rectangle').removeClass('backgroundgreen')
  $('#rectangle').addClass('backgroundgrey')

  disableP2React();
  disableP1React();
  unReadyPlayerOne();
  unReadyPlayerTwo();
}

const player1Ready = () => {
  // tell the server p1 is ready
  // we do not toggle UI here because this socket will send the event to server
  // which sends back p1isready event to ALL sockets in room which will then toggle UI
  socket.emit('p1ready', {
    username,
    room
  }, (error) => {
    if (error) {
      // this only triggers if P2 tries pressing P1's button, likewise for the P2 method
      alert(error)
    }
  })
}

const player2Ready = () => {
  // tell the server p2 is ready
  socket.emit('p2ready', {
    username,
    room
  }, (error) => {
    if (error) {
      alert(error)
    }
  })
}

const player1React = () => {
  socket.emit("p1react", {
    username,
    room
  }, (error) => {
    if (error) {
      alert(error)
    }
  })
}

const player2React = () => {
  socket.emit("p2react", {
    username,
    room
  }, (error) => {
    if (error) {
      alert(error)
    }
  })
}

// add an announcement by using mustache to render a div with a unique id, and an li inside it
const AddAnnouncement = (text) => {
  const html = Mustache.render($AnnounceTemplate, {
    text,
    div_id: announcement_number
  })
  let this_announcement = announcement_number;
  announcement_number += '0';
  $announcements.insertAdjacentHTML('beforeEnd', html)
  fade(this_announcement);
}

socket.on('announcement', ({text}) => {
    AddAnnouncement(text);
})

// called when a player leaves from an unfinished game. Resets the UI for the player that is still in the lobby
// for another game to start, should another user join in
socket.on("resetGame", () => {
  roundIsRunning = false;
  ResetUIForNewRound();
  // clear P1 score, P1 times, P2 score, P2 times, P1 avgtime P2 avgtime
  $('#player1_score').text(0);
  $('#player2_score').text(0);
  document.querySelector('#player1_times').innerHTML = '';
  document.querySelector('#player2_times').innerHTML = '';
  document.querySelector('#player1_average').text(0 + ' ms')
  document.querySelector('#player2_average').text(0 + ' ms')
})

// this method takes in the user information and displays it on the screen
// will receive this event on user join and disconnect
socket.on('roomData', ({users}) => {
  let player1, player2;
  if (users.length >= 1) {
    player1 = users[0].username;
  }
  if (users.length >= 2) {
    player2 = users[1].username;
  }

  if (player1) {
    $player1Username.innerHTML = player1;
  }
  else {
    $player1Username.innerHTML = "Waiting for Player...";
  }
  if (player2) {
    $player2Username.innerHTML = player2;
  }
  else {
    $player2Username.innerHTML = "Waiting for Player...";
  }

})

// The server gives the UI the amount of time to wait until changing inner rectangle to green
socket.on("startRound", (timeUntilGreen) => {
  roundIsRunning = true;
  $('#rectangle-messages').html('Watch closely...')
  enableP1React();
  enableP2React();

  setTimeout(() => {
    // change the rectangle to green
    if (roundIsRunning) {
      $('#rectangle').removeClass('backgroundgrey')
      $('#rectangle').addClass('backgroundgreen')
      $('#rectangle-messages').html('Go!')
    }
  }, (timeUntilGreen) * 1000)
})

socket.on("p1isready", () => {
  readyPlayerOne();
})

socket.on("p2isready", () => {
  readyPlayerTwo();
})

// the following three methods add items to the ordered list keeping track of results from past rounds
function createMenuItem(name) {
  let li = document.createElement('li');
  li.textContent = name;
  return li;
}

const addP1Time = (time) => {
  if (time === 1000000) {
    document.querySelector('#player1_times').appendChild(createMenuItem("Early!"))
  }
  else {
    document.querySelector('#player1_times').appendChild(createMenuItem(time + " ms"))
  }
}

const addP2Time = (time) => {
  if (time === 1000000) {
    document.querySelector('#player2_times').appendChild(createMenuItem("Early!"))
  }
  else {
    document.querySelector('#player2_times').appendChild(createMenuItem(time + " ms"))
  }
}

const calculateP1Avg = () => {
  // calculate the average reaction time of player 1- done by taking all the non early-reaction scores and averaging
  let sum = 0;
  let numberOfTimes = 0;
  $('#player1_times').children('li').each(function () {
    if ($(this).text() === 'Early!') {
      // skip
    }
    else {
      sum += parseInt($(this).text())
      numberOfTimes++;
    }  
  });

  let average;
  if (numberOfTimes == 0) {
    average = 0;
  }
  else {
    average = Math.ceil(sum / numberOfTimes);
  }
  document.querySelector('#player1_average').innerHTML = ('Average: ' + average + ' ms');
}

const calculateP2Avg = () => {
  let sum = 0;
  let numberOfTimes = 0;
  $('#player2_times').children('li').each(function () {
    if ($(this).text() === 'Early!') {
      // skip
    }
    else {
      sum += parseInt($(this).text())
      numberOfTimes++;
    }  
  });

  let average;
  if (numberOfTimes == 0) {
    average = 0;
  }
  else {
    average = Math.ceil(sum / numberOfTimes);
  }
  document.querySelector('#player2_average').innerHTML = ('Average: ' + average + ' ms')
}

// the following two events are sent whenever a user in the lobby reacts
// it does four things: add announcement to screen, disable the button, adds the time to the ordered list, and calculate new average times
socket.on("p1reacted", ({username, time}) => {
  time = Math.ceil(time)
  if (time == 1000000) {
    console.log("player one reacted too early!")
    AddAnnouncement(username + " jumped the gun!");
  }
  else {
    AddAnnouncement(username + " reacted in " + time + " ms!");
  }
  disableP1React();
  addP1Time(time);
  calculateP1Avg();
  calculateP2Avg();
})

socket.on("p2reacted", ({username, time}) => {
  time = Math.ceil(time)
  if (time == 1000000) {
    console.log("player two reacted too early!")
    AddAnnouncement(username + " jumped the gun!");
  }
  else {
    AddAnnouncement(username + " reacted in " + time + " ms!");
  }
  disableP2React();
  addP2Time(time);
  calculateP1Avg();
  calculateP2Avg();
})

// this event is broadcasted when a player wins a round- the server will give the two times of the players and the UI displays the winners message in the rectangle
// also resposible for resetting the UI for a new round
socket.on("p1won", (p1time, p2time, p1username, p2username) => {
  roundIsRunning = false;

  let value = $('#player1_score').text();
  $('#player1_score').text(parseInt(value)+1);

  // display winner message
  if (p2time === 1000000) {
    // if user won because other user reacted too early
    $('#rectangle-messages').html(p2username + " went early, " + p1username + " wins! Ready up for next round")
  }
  else {
    let marginofwin = p2time - p1time;
    $('#rectangle-messages').html(p1username + " won by " + marginofwin + " ms! Ready up for next round")
  }

  ResetUIForNewRound();

})

socket.on("p2won", (p1time, p2time, p1username, p2username) => {
  roundIsRunning = false;

  let value = $('#player2_score').text();
  $('#player2_score').text(parseInt(value)+1);
  if (p1time === 1000000) {
    // if user won because other user reacted too early
    $('#rectangle-messages').html(p1username + " went early, " + p2username + " wins! Ready up for next round")
  }
  else {
    let marginofwin = p1time - p2time;
    $('#rectangle-messages').html(p2username + " won by " + marginofwin + " ms! Ready up for next round")
  }

  ResetUIForNewRound();
})

// for when both players go early
socket.on("neitherwon", () => {
  roundIsRunning = false;

  $('#rectangle-messages').html("Both players reacted early, no one wins! Ready up for next round")
  ResetUIForNewRound();
})

// if the game ends, BOTH users get an alert saying who won, and then are sent straight to the lobby
// this is probably not the best solution but for now a fitting ending (I got lots of bugs when trying to do other things)
socket.on("gameover", (userwhowon) => {
  console.log(userwhowon, " wins the game!")
  
  alert(userwhowon + " won the game! Thanks for playing! To play again, start a new room  ");
  location.href = "/" 
})

// if a user joins this URL, emit a join event so the server know they did! (Also send them back to join page if invalid)
socket.emit('join', {
    username,
    room
}, (error) => {
    if (error) {
        alert(error)
        // send the user back to the join page
        location.href = "/" 
    }
})