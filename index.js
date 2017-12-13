'use strict'

require('dotenv').config()

const async = require('async')
const fs = require('fs')
const readline = require('readline')
const SDK = require('watsonworkspace-sdk')

SDK.level('error')

// use a .env file to define the APP_ID and APP_SECRET or hard code it here
const app = new SDK(
  process.env.APP_ID,
  process.env.APP_SECRET
)

// the directory is a command line argument
const dir = process.argv[2]
const script = JSON.parse(fs.readFileSync(`${dir}/script.json`, 'utf8'))

// track the current line and the callback to trigger the next line
let lineCounter = 0
let callback = null

// authenticate this app
app.authenticate().then(token => {
  printNextLine()

  // read in from the terminal
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })

  // and input sent from the terminal triggers the next message to be sent
  rl.on('line', (line) => {
    sendLine()
    printNextLine()
  })

  // authenticate any actors' JWT tokens
  authenticateActors((error) => {
    // once authenticated, begin processing lines synchronously
    if (!error) {
      async.eachSeries(script.lines, (line, cb) => {
        const delay = line.delay === undefined ? simulateDelay(line) : line.delay
        const auto = line.auto || false

        callback = cb // sendLine() will call callback to proceed to next line

        // auto messages are sent automatically based on the delay
        if (auto) {
          console.log(`Waiting ${delay / 1000} seconds`)
          setTimeout(() => {
            sendLine(line)
          }, delay)
        } else {
          // otherwise the message waits for the user to send
        }
      })
    }
  })
})

function printNextLine () {
  const line = script.lines[lineCounter]

  if (line.text) {
    console.log(`Line[${lineCounter}] '${line.text}'`)
  }

  if (line.filename) {
    console.log(`Line[${lineCounter}] file=${line.filename}`)
  }
}

// attempt to get the profile for each actor to validate token
function authenticateActors (callback) {
  const actors = Object.getOwnPropertyNames(script.actors)

  async.eachSeries(
    actors,
    (actor, cb) => {
      const sdk = new SDK('', '', script.actors[actor])

      sdk.getMe(['id'])
      .then(person => {
        console.log(`${actor} READY`)
        script.actors[actor] = sdk  // replace the JWT token with the SDK
        cb()
      })
      .catch(error => {
        console.log(`${actor} FAILED`)
        cb(error)
      })
    },
    error => callback(error))
}

// tries to simulate natural reading and typing proficiency level
function simulateDelay (line) {
  // average reading and typing words per minute
  const rate = {
    read: 200,
    write: 50
  }

  let numOfReadWords = 0

  if (line.text) {
    numOfReadWords = line.text.split(' ').length
  }

  // just calculate the read time since people are watching the replay
  const delay = ((numOfReadWords / rate.read) * 60 * 1000)

  // console.log(`simulateDelay=${delay}`)

  return delay
}

// send either a text message or file that is the current line in queue
function sendLine () {
  const line = script.lines[lineCounter]

  // get the actor's app or use the main app if no actor is specified
  const actor = script.actors[line.actor] || app

  const spaceId = script.spaces[line.space]

  if (line.text) {
    console.log(`${line.actor} said, '${line.text}'`)
    actor.sendSynchronousMessage(spaceId, line.text)
    .then(message => {
      lineCounter++
      callback()
    })
    .error(error => console.log(error))
  }

  if (line.filename) {
    console.log(`${line.actor} sent ${line.filename}`)
    actor.sendFile(spaceId, `${dir}/${line.filename}`)
    .then(message => {
      lineCounter++
      callback()
    })
    .error(error => console.log(error))
  }
}
