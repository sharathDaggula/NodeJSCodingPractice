const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()

app.use(express.json())
const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    // initializing database
    db = await open({filename: dbpath, driver: sqlite3.Database})
    // initializing server
    app.listen(3000, () => {
      console.log('Server is running at http://localhost:3000...')
    })
  } catch (e) {
    console.log('connection error : ' + e)
    process.exit(1)
  }
}

initializeDBAndServer()

const check = async (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    try {
      const payload = jwt.verify(jwtToken, 'secretkey')
      request.user = payload
      next()
    } catch (e) {
      response.status(401)
      response.send('Invalid JWT Token')
    }
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  const hashedPass = await bcrypt.hash(password, 10)

  try {
    const getUserDetails = `SELECT * FROM user WHERE username = '${username}';`
    const user = await db.get(getUserDetails)

    if (user === undefined) {
      response.status(400)
      response.send('Invalid user')
      return
    } else {
      const ispasswordright = await bcrypt.compare(password, user.password)
      if (!ispasswordright) {
        response.status(400)
        response.send('Invalid password')
        return
      } else {
        const payload = {
          username: username,
        }
        const token = jwt.sign(payload, 'secretkey')
        response.send({jwtToken: token})
      }
    }
  } catch (e) {
    console.log('Internal error : ' + e)
  }
})

app.get('/states/', check, async (request, response) => {
  try {
    const getStateDetails = `SELECT * FROM state;`
    const dbResult = await db.all(getStateDetails)
    const result = dbResult.map(eachItem => ({
      stateId: eachItem.state_id,
      stateName: eachItem.state_name,
      population: eachItem.population,
    }))
    response.status(200)
    response.send(result)
  } catch (e) {
    console.log('get api error : ' + e)
  }
})

app.get('/states/:stateId/', check, async (request, response) => {
  const {stateId} = request.params
  try {
    const getStateQuery = `
  SELECT * FROM state WHERE state_id = ${stateId};`
    const result = await db.get(getStateQuery)
    response.status(200)
    response.send({
      stateId: result.state_id,
      stateName: result.state_name,
      population: result.population,
    })
  } catch (e) {
    console.log('get api error : ' + e)
  }
})

app.post('/districts/', check, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  try {
    const addNewUserQuery = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES ('${districtName}',${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`
    await db.run(addNewUserQuery)
    response.status(200)
    response.send('District Successfully Added')
  } catch (e) {
    console.log('post api error: ' + e)
  }
})

app.get('/districts/:districtId/', check, async (request, response) => {
  const {districtId} = request.params
  try {
    const getDistrictQuery = `
    SELECT * FROM district WHERE district_id = ${districtId};`
    const result = await db.get(getDistrictQuery)
    response.status(200)
    response.send({
      districtId: result.district_id,
      districtName: result.district_name,
      stateId: result.state_id,
      cases: result.cases,
      cured: result.cured,
      active: result.active,
      deaths: result.deaths,
    })
  } catch (e) {
    console.log('get api error: ' + e)
  }
})

app.delete('/districts/:districtId/', check, async (request, response) => {
  const {districtId} = request.params
  try {
    const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id = ${districtId};`
    await db.run(deleteDistrictQuery)
    response.status(200).send('District Removed')
  } catch (e) {
    console.log('get api error: ' + e)
  }
})

app.put('/districts/:districtId/', check, async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  try {
    const updateDistrictQuery = `
    UPDATE district 
    SET district_name = '${districtName}', state_id = ${stateId}, cases=${cases}, cured=${cured}, active=${active}, deaths=${deaths}
    WHERE district_id = ${districtId}`
    await db.run(updateDistrictQuery)
    response.status(200)
    response.send('District Details Updated')
  } catch (e) {
    console.log('post api error: ' + e)
  }
})

app.get('/states/:stateId/stats/', check, async (request, response) => {
  const {stateId} = request.params
  try {
    const getStatsQuery = `
    SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId};`
    const result = await db.get(getStatsQuery)
    response.status(200)
    response.send(result)
  } catch (e) {
    console.log('get api error: ' + e)
  }
})

module.exports = app
