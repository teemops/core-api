#!/usr/bin/env node
/**
 * Runs in the background and checks that all AWS accounts connected have been added permissions to the Cloudwatch events bus.
 * 
 */

if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 