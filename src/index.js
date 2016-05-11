import _ from 'lodash'
import Queue from 'queue-async'
import {directoryFunctionModules} from 'fl-server-utils'

export default (options, callback) => {
  const {User, database_url, models_dir, scaffold} = options
  if (!User) return console.error('[fl-initdb] Missing User from options')
  if (!database_url) return console.error('[fl-initdb] Missing database_url from options')
  if (!models_dir) return console.error('[fl-initdb] Missing models_dir from options')
  if (!scaffold) return console.error('[fl-initdb] Missing scaffold from options')

  const queue = new Queue(1)

  // Create the database if we're using postgres
  if (database_url.split(':')[0] === 'postgres') {

    queue.defer(callback => {
      const pg = require('pg')
      const split = database_url.split('/')
      const database_name = split[split.length-1]
      const conn_string = database_url.replace(database_name, 'postgres')

      pg.connect(conn_string, (err, client, done) => {
        if (err) return console.error('error connecting to postgres db', err)

        client.query(`SELECT datname FROM pg_catalog.pg_database WHERE lower(datname) = lower('${database_name}')`, (err, result) => {
          if (err || result && result.rowCount > 0) return callback(err)

          console.log('Creating database', database_name)
          const query = `CREATE DATABASE "${database_name}"`
          client.query(query, err => {
            done()
            if (err) console.error('error creating database with query:', query, 'error:', err)
            callback(err)
          })
        })
      })
    })

    // Ensure each model has columns according to its schema
    const Models = directoryFunctionModules(models_dir)
    _.forEach(options.Models || [], (Model, name) => Models[name] = Model)
    _.forEach(Models, Model => queue.defer(callback => Model.db().ensureSchema(callback)))
  }

  // If we don't have an admin user run the scaffold script for this environment
  queue.defer(callback => {
    User.exists({admin: true}, (err, exists) => {
      if (err || exists) return callback(err)

      console.log(`No admin user exists. Running scaffold script for env ${process.env.NODE_ENV}`)
      try {
        scaffold(callback)
      }
      catch (err) {
        console.log('Error scaffolding:', err)
        return callback(err)
      }
    })
  })

  queue.await(callback)
}
