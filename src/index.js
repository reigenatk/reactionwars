const { time } = require('console')
const express = require('express')
const http = require('http')
const { restart, reset } = require('nodemon')
const path = require('path')
const socketio = require('socket.io')
const {addUser, removeUser, resetUser, getUsersInRoom, 
    numberOfPlayersInRoom, getPlayerOne, getPlayerTwo, readyPlayer, 
    AreBothPlayersReady, AddGame, getGame, playerOneReacted,
    playerTwoReacted, findWinner, resetRound, deleteGame} = require('./users.js')

const app = express()

const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, "../public")

app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {
    console.log('New connection')
    
    socket.on('join', (userdata, callback) => {
        const {error, user} = addUser({
            id: socket.id, 
            username: userdata.username, 
            room: userdata.room
        })

        if (error) {
            // use return to not continue execution
            return callback(error)
        }
        else {
            // join a user to the requested room using socket.io method
        socket.join(user.room)

        // send a welcome announcement to the user that just joined
        socket.emit("announcement", {text: "Welcome to Reaction Wars, " + user.username})

        // if player that just joined is second player, then check to see if P1 has toggled his ready button
        if (numberOfPlayersInRoom(user.room) === 2) {           
            let playerone = getPlayerOne(user.room);
            if (playerone.ready) {
                // if he has then we need to signal that to P2's UI
                socket.emit("p1isready");
            }
        }
        
        socket.broadcast.to(user.room).emit("announcement", {text: user.username + " has joined the room"})

        io.to(user.room).emit("roomData", {
            users: getUsersInRoom(user.room)
        })

        callback()
        }
    })

    // when a user disconnects
    // disconnect is a BUILT IN event

    // in my game, if a user disconnects from say a lobby of two people, all games associated with those two are deleted.
    // whichever player is remaning becomes player 1 automatically, and a new user is allowed to join that room
    // to start a completely new game with the user that didn't leave.
    socket.on('disconnect', () => {
        console.log("A user disconnected")
        const user = removeUser(socket.id)
        // only actually emit a message if the user existed
        if (user) {
            io.to(user.room).emit("announcement", {text: user.username + " has left the room"})
            
            // this event tells the UI what to display in terms of users
            io.to(user.room).emit("roomData", {
                users: getUsersInRoom(user.room)
            })

            // we also ought to delete the game with the user who just left, from the list of games, if there were any
            deleteGame(user.room);

            // if the other player is still waiting in the room
            // then reset the status of that player (score, ready state)

            // sidenote: if the users are leaving because the game is over, this method still runs but thats ok
            // since the other user left will also leave and the user object will be deleted (since he will be redirected to /)
            if (getPlayerOne(user.room)) {
                resetUser(getPlayerOne(user.room).id);
            

                // broadcast an event to the remaining user, telling its UI to clear all the data from previous game
                // same sidenote: if game is over, the last user to leave will have his UI reset, but will be redirected to / shortly after
                // so he cannot click on the activated buttons.
                io.to(user.room).emit("resetGame");
            }
        }
    })
    

    socket.on('p1ready', (userdata, callback) => {
        const id = socket.id;
        if (id != getPlayerOne(userdata.room).id) {
            return callback("You aren't player 1 >:(")
        }

        io.to(userdata.room).emit("announcement", {text: getPlayerOne(userdata.room).username + " is ready!"})
        readyPlayer(id);
        io.to(userdata.room).emit('p1isready');
        if (AreBothPlayersReady(userdata.room)) {
            // start round
            timeToReact = (Math.random() * 10) + 3; // time between 3 and 13 sec
            startTime = new Date().getTime();

            AddGame(userdata.room, startTime, timeToReact);
            io.to(userdata.room).emit("startRound", timeToReact);

        }
        callback();
    })

    socket.on('p2ready', (userdata, callback) => {
        const id = socket.id;

        // there's an annoying case here where P1 presses P2's ready even though P2 is not in the room
        // so we need to check also if P2 is even here else we crash the app
        // cannot happen the other way around though
        if (!getPlayerTwo(userdata.room) || id != getPlayerTwo(userdata.room).id) {
            return callback("You aren't player 2 >:(")
        }

        io.to(userdata.room).emit("announcement", {text: getPlayerTwo(userdata.room).username + " is ready!"})
        readyPlayer(id);
        io.to(userdata.room).emit('p2isready');
        if (AreBothPlayersReady(userdata.room)) {
            // start round
            timeToReact = (Math.random() * 10) + 3; // time between 3 and 13 sec
            startTime = new Date().getTime();

            AddGame(userdata.room, startTime, timeToReact);
            io.to(userdata.room).emit("startRound", timeToReact);
        }
        callback();
    })

    socket.on('p1react', (userdata, callback) => {
        const id = socket.id;
        if (id != getPlayerOne(userdata.room).id) {
            return callback("You aren't player 1 >:(")
        }

        let currentGame = getGame(userdata.room);
        let roundStart = currentGame.startTime;
        let timeToReact = currentGame.timeToReact;
        let currentTime = new Date().getTime();
        
        // its a little confusing but timeToReact is in seconds, but currentTime and roundStart
        // are in ms, so I need to convert timetoReact to ms by doing *1000
        if (currentTime - roundStart < timeToReact * 1000) {
            // if user reacted too early..
            // I used 1 million as a constant to indicate early reaction times
            // its equivalent to 1 mil ms or 1000 seconds, which is like 16 min
            io.to(userdata.room).emit("p1reacted", {
                username: userdata.username,
                time: 1000000
            });
            playerOneReacted(1000000, userdata.room);
        }
        else {
            io.to(userdata.room).emit("p1reacted", {
                username: userdata.username,
                time: currentTime - (roundStart + timeToReact * 1000)
            });
            playerOneReacted(currentTime - (roundStart + timeToReact * 1000), userdata.room)
        }
        
        // check to see if the game has ended (both players have reacted)
        let currentGame2 = getGame(userdata.room);
        if (currentGame2.p1time !== -1 && currentGame2.p2time !== -1) {

            // so we have 3 cases here:
            // 1. p1 and p2 react without errors, p1 beats p2 or p2 beats p1
            // 2. One of them reacts early, the other doesn't. IN this case the one who reacts early gets a huge penalty time of 1 mil ms
            // 3. Both react early, in which case neither should win

            if (currentGame2.p1time === 1000000 && currentGame2.p2time === 1000000) {
                // case 3
                io.to(userdata.room).emit("neitherwon");
            }
            else {
                // cases 1 and 2
                if (currentGame2.p1time < currentGame2.p2time) {
                    io.to(userdata.room).emit("p1won", currentGame2.p1time, currentGame2.p2time, getPlayerOne(userdata.room).username, getPlayerTwo(userdata.room).username);
                }
                else {
                    io.to(userdata.room).emit("p2won", currentGame2.p1time, currentGame2.p2time, getPlayerOne(userdata.room).username, getPlayerTwo(userdata.room).username)
                }
            }

            let winnerOfGame = findWinner(userdata.room);
            if (winnerOfGame) {
                // game is over, tell the UI to disable all gameplay buttons
                io.to(userdata.room).emit("gameover", winnerOfGame);

                // delete the game
                deleteGame(userdata.room);

                // when the users disconnect, the two user objects will be deleted via the removeUser method so we don't need to implement that here
            }
            else {
                // otherwise reset the info about the round + user ready states in the users.js file
                resetRound(userdata.room);
            }
        }
        
        callback()
    })

    socket.on('p2react', (userdata, callback) => {
        const id = socket.id;
        if (id != getPlayerTwo(userdata.room).id) {
            return callback("You aren't player 2 >:(")
        }

        let currentGame = getGame(userdata.room);
        let roundStart = currentGame.startTime;
        let timeToReact = currentGame.timeToReact;
        let currentTime = new Date().getTime();

        if (currentTime - roundStart < timeToReact * 1000) {
            // reacted too early..
            io.to(userdata.room).emit("p2reacted", {
                username: userdata.username, 
                time: 1000000
            });
            playerTwoReacted(1000000, userdata.room);
        }
        else {
            io.to(userdata.room).emit("p2reacted", {
                username: userdata.username,
                time: currentTime - (roundStart + timeToReact * 1000)
            })
            playerTwoReacted(currentTime - (roundStart + timeToReact * 1000), userdata.room)
        }

        let currentGame2 = getGame(userdata.room);
        if (currentGame2.p1time !== -1 && currentGame2.p2time !== -1) {

            if (currentGame2.p1time === 1000000 && currentGame2.p2time === 1000000) {
                // case 3
                io.to(userdata.room).emit("neitherwon");
            }
            else {
                // cases 1 and 2
                if (currentGame2.p1time < currentGame2.p2time) {
                    io.to(userdata.room).emit("p1won", currentGame2.p1time, currentGame2.p2time, getPlayerOne(userdata.room).username, getPlayerTwo(userdata.room).username);
                }
                else {
                    io.to(userdata.room).emit("p2won", currentGame2.p1time, currentGame2.p2time, getPlayerOne(userdata.room).username, getPlayerTwo(userdata.room).username)
                }
            }
            
            let winnerOfGame = findWinner(userdata.room);
            if (winnerOfGame) {
                io.to(userdata.room).emit("gameover", winnerOfGame);

                deleteGame(userdata.room);
            }
            else {
                resetRound(userdata.room);
            }
        }

        callback()
    })

    socket.on('sendAnnouncement', ({message, room}) => {
        io.to(room).emit("announcement", {text: message});
    })

    })


server.listen(port, () => {
    console.log("Server is up")
})
