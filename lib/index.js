'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _queueAsync = require('queue-async');

var _queueAsync2 = _interopRequireDefault(_queueAsync);

var _flServerUtils = require('fl-server-utils');

exports['default'] = function (options, callback) {
  var User = options.User;
  var database_url = options.database_url;
  var models_dir = options.models_dir;
  var scaffold = options.scaffold;

  if (!User) return console.error('[fl-initdb] Missing User from options');
  if (!database_url) return console.error('[fl-initdb] Missing database_url from options');
  if (!models_dir) return console.error('[fl-initdb] Missing models_dir from options');
  if (!scaffold) return console.error('[fl-initdb] Missing scaffold from options');

  var queue = new _queueAsync2['default'](1);

  // Create the database if we're using postgres
  if (database_url.split(':')[0] === 'postgres') {
    (function () {

      queue.defer(function (callback) {
        var pg = require('pg');
        var split = database_url.split('/');
        var database_name = split[split.length - 1];
        var conn_string = database_url.replace(database_name, 'postgres');

        pg.connect(conn_string, function (err, client, done) {
          if (err) return console.error('error connecting to postgres db', err);

          client.query('SELECT datname FROM pg_catalog.pg_database WHERE lower(datname) = lower(\'' + database_name + '\')', function (err, result) {
            if (err || result && result.rowCount > 0) return callback(err);

            console.log('Creating database', database_name);
            var query = 'CREATE DATABASE "' + database_name + '"';
            client.query(query, function (err) {
              done();
              if (err) console.error('error creating database with query:', query, 'error:', err);
              callback(err);
            });
          });
        });
      });

      // Ensure each model has columns according to its schema
      var Models = (0, _flServerUtils.directoryFunctionModules)(models_dir);
      _lodash2['default'].forEach(options.Models || [], function (Model, name) {
        return Models[name] = Model;
      });
      _lodash2['default'].forEach(Models, function (Model) {
        return queue.defer(function (callback) {
          return Model.db().ensureSchema(callback);
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