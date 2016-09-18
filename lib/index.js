'use strict';

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

exports.__esModule = true;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _queueAsync = require('queue-async');

var _queueAsync2 = _interopRequireDefault(_queueAsync);

var _flServerUtils = require('fl-server-utils');

exports['default'] = function (options, callback) {
  var User = options.User;
  var databaseUrl = options.databaseUrl;
  var modelsDir = options.modelsDir;
  var scaffold = options.scaffold;

  if (!User) return console.error('[fl-initdb] Missing User from options');
  if (!databaseUrl) return console.error('[fl-initdb] Missing databaseUrl from options');
  if (!modelsDir) return console.error('[fl-initdb] Missing modelsDir from options');
  if (!scaffold) return console.error('[fl-initdb] Missing scaffold from options');

  var queue = new _queueAsync2['default'](1);

  // Create the database if we're using postgres
  if (databaseUrl.split(':')[0] === 'postgres') {
    (function () {

      queue.defer(function (callback) {
        var pg = require('pg');
        var split = databaseUrl.split('/');
        var databaseName = split[split.length - 1];
        var connectionString = databaseUrl.replace(databaseName, 'postgres');

        pg.connect(connectionString, function (err, client, done) {
          if (err) return console.error('error connecting to postgres db', err);

          client.query('SELECT datname FROM pg_catalog.pg_database WHERE lower(datname) = lower(\'' + databaseName + '\')', function (err, result) {
            if (err || result && result.rowCount > 0) return callback(err);

            console.log('Creating database', databaseName);
            var query = 'CREATE DATABASE "' + databaseName + '"';
            client.query(query, function (err) {
              done();
              if (err) console.error('error creating database with query:', query, 'error:', err);
              callback(err);
            });
          });
        });
      });

      // Ensure each model has columns according to its schema
      var Models = _flServerUtils.directoryFunctionModules(modelsDir);
      _lodash2['default'].forEach(options.Models || [], function (Model, name) {
        return Models[name] = Model;
      });
      _lodash2['default'].forEach(Models, function (Model) {
        return queue.defer(function (callback) {
          console.log('Ensuring schema for', Model.name);
          Model.db().ensureSchema(callback);
        });
      });
    })();
  }

  // If we don't have an admin user run the scaffold script for this environment
  queue.defer(function (callback) {
    User.exists({ admin: true }, function (err, exists) {
      if (err || exists) return callback(err);

      console.log('No admin user exists. Running scaffold script for env ' + process.env.NODE_ENV);
      try {
        scaffold(callback);
      } catch (err) {
        console.log('Error scaffolding:', err);
        return callback(err);
      }
    });
  });

  queue.await(callback);
};

module.exports = exports['default'];