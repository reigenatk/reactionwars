// store all the users + games currently running. Users are identified by their socket ID, games are identified by the room they take place in

const users = [] // id, username, room, ready, score

// room, p1id, p2id, startTime, timeToReact, p1time, p2time
const games = [] 

const addUser = ({id, username, room}) => {
    if (getUsersInRoom(room).length === 2) {
        // room full
        return {
            error: "This room is full!"
        }
    }
    username = username.trim()
    room = room.trim()

    if (!username || !room) {
        return {
            error: 'Username and room are required'
        }
    }

    const existing = users.find((user) => {
        return (user.room === room && user.username === username)
    })
    if (existing) {
        return {
            error: 'User already exists in this room'
        }
    }

    user = {id, username, room, ready: false, score: 0};
    users.push(user)
    return {user};
}

// removeUser
const removeUser = (id) => {
    // find index and then remove it, returning the user we just removed

    const index = users.findIndex((user) => {
        return user.id === id
    })
    
    if (index === -1) {
        // if not found, then return since there's nothin to delete
        return
    }

    // splice returns array of elements removed
    // we want first one (there is only one anyways)
    return users.splice(index, 1)[0]
}

// getUser
const getUser = (id) => {
    return users.find((user) => {
        return user.id === id
    })
}

// getUsersInRoom
const getUsersInRoom = (room) => {
    return users.filter((user) => {
        return user.room === room
    })
}

const numberOfPlayersInRoom = (room) => {
    let usersInRoom = users.filter((user) => {
        return user.room === room
    })
    return usersInRoom.length;
}

const getPlayerOne = (room) => {
    const firstPersonInRoom = users.find((user) => {
        return (user.room === room);
    })
    return firstPersonInRoom;
}

const getPlayerTwo = (room) => {
    let firstPersonInRoom;
    let secondPersonInRoom;
    for (let i = 0; i < users.length; i++) {
        if (users[i].room === room) {
            if (!firstPersonInRoom) {

                firstPersonInRoom = users[i];
            }
            else {

                secondPersonInRoom = users[i];
            }
        }
    }
    if (secondPersonInRoom) {
        return secondPersonInRoom;
    }
    else {
        return undefined;
    }
}

const readyPlayer = (id) => {
    const index = users.findIndex((user) => {
        return user.id === id
    })
    users[index].ready = true;
}

// this method is important since we need some way of knowing when to start the round, and this checks if we can or not
const AreBothPlayersReady = (room) => {
    let playersinroom = getUsersInRoom(room);
    if (playersinroom.length == 2) {
        return playersinroom[0].ready && playersinroom[1].ready
    }
}

const AddGame = (room, startTime, timeToReact) => {
    let existing = games.findIndex((game) => {
        return game.room === room
    })

    if (existing !== -1) {
        // this means we have a new round starting- in this case we just want to update the values of startTime and timeToReact
        games[existing].startTime = startTime;
        games[existing].timeToReact = timeToReact;
    }
    else {
        // otherwise its the first round so actually add this game to the array
        let game = {
            room,
            startTime,
            timeToReact,
            p1time: -1,
            p2time: -1
        }
        games.push(game);
    }
}

const getGame = (room) => {
    return games.find((game) => {
        return game.room === room
    })
}

const playerOneReacted = (time, room) => {
    const index = games.findIndex((game) => {
        return game.room === room
    })
    games[index].p1time = time;
}

const playerTwoReacted = (time, room) => {
    const index = games.findIndex((game) => {
        return game.room === room
    })
    games[index].p2time = time;
}

// this method is called after a round has finished in the room that is passed as a param
// it find who the winner is, gives them a point, and if the game is over, returns the username of the winner
// else it return nothing
const findWinner = (room) => {
    let pointsToWin = 10; // can change this

    const index = games.findIndex((game) => {
        return game.room === room
    })
    let idOfPlayer1 = getPlayerOne(room).id;
    const indexofP1 = users.findIndex((user) => {
        return user.id === idOfPlayer1
    })

    let idOfPlayer2 = getPlayerTwo(room).id;
    const indexofP2 = users.findIndex((user) => {
        return user.id === idOfPlayer2
    })

    if (games[index].p1time === 1000000 && games[index].p2time === 1000000) {
        // nobody gets points
    }
    else {
        if (games[index].p1time < games[index].p2time) {
            // Player 1 won this round, give him a point
            users[indexofP1].score++;
            if (users[indexofP1].score === pointsToWin) {
                // p1 wins the game
                return users[indexofP1].username
            }
        }
        else {
            // P2 won
            users[indexofP2].score++;
            if (users[indexofP2].score === pointsToWin) {
                // p2 wins the game
                return users[indexofP2].username
            }
        }
    }
}

// this method is called also after a round has finished, it sets the ready states of the players in that room back to false
// and resets the current round info (since the last round information is irrelevant since it just ended)
const resetRound = (room) => {
    const index = games.findIndex((game) => {
        return game.room === room
    })
    let idOfPlayer1 = getPlayerOne(room).id;
    const indexofP1 = users.findIndex((user) => {
        return user.id === idOfPlayer1
    })

    let idOfPlayer2 = getPlayerTwo(room).id;
    const indexofP2 = users.findIndex((user) => {
        return user.id === idOfPlayer2
    })

    // now reset- we will set all game related fields to -1 if a round hasn't started
    games[index].roundStart = -1;
    games[index].timeToReact = -1;
    games[index].p1time = -1;
    games[index].p2time = -1;

    // also change the ready states of both users back to false
    users[indexofP1].ready = false;
    users[indexofP2].ready = false;
}

// resetUser is called in the following case: when a player leaves a full (2 player) lobby, the other player
// may still be inside. So what happens is we reset that players' ready state and score for a possible new game if another new player joins in
const resetUser = (id) => {
    const indexofplayer = users.findIndex((user) => {
        return user.id === id
    })
    users[indexofplayer].score = 0;
    users[indexofplayer].ready = false;
}

// delete a game given the room its in. Need to call this after a game ends (aka someone wins by reaching x points)
const deleteGame = (room) => {
    const index = games.findIndex((game) => {
        return game.room === room
    })
    if (index) {
        // if this game existed 
        games.splice(index, 1);
    }
}

module.exports = {
    addUser,
    removeUser,
    resetUser,
    getUser,
    getUsersInRoom,
    numberOfPlayersInRoom,
    getPlayerOne,
    getPlayerTwo,
    readyPlayer,
    AreBothPlayersReady,
    AddGame,
    getGame,
    playerOneReacted,
    playerTwoReacted,
    findWinner,
    resetRound, 
    deleteGame
}