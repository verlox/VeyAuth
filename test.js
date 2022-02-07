const winston = require('winston');
const { Auth, User, App } = require("./dist");
const { UserPermissionsArray }= require('./dist/types/UserPermissionsArray.js');
const { FLAGS } = require('./dist/types/UserPermissions.js');
const fs = require('fs');
require("dotenv").config();

var auth = new Auth({
    level: 'debug',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.align(),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console({ format: winston.format.colorize() }),
        new winston.transports.File({ filename: 'debug.log', level: 'debug' }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ]
})

// console.log(require('./dist/utils/Utils.js').Utils.hasSpecialChars("whatthe+fuck"))

setTimeout(async() => {
    try {
        var admin = await User.verify('token');
        var app = await App.get(0, App.GET_FLAGS.GET_BY_ID);

        (await User.get(1)).permissions.set(0, -1).save();

        var newuser = await User.create(admin, app, `verlox${Math.round(Math.random() * 999)}`, 'godcc')
        // var app = await App.create(newuser, `testapp${Math.round(Math.random() * 999)}`);
        
        // app.setOwner(admin);
        // await app.save(admin);
        newuser.permissions.set(0, FLAGS.MODIFY_USERS);
        await newuser.permissions.save(admin);

        // await app.delete(newuser);
        await newuser.delete();

        // User.get('eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6InZlcmxveCIsInBhc3N3b3JkIjoiOWRmZjY3ZjdkODdlN2RiNTFiMDMwZGEyY2VjZDhhMmQ1OGU0ZDU4MTdhMTA4YzNmZDM0NjExYjgxNzkzNzJlMSJ9.s37y3oOrvetdOWQDICdwMsHIqDhUSuWpEv8hOAR2YcjUNsqiubL0nbZdGzfeQVyGUrLjmaPlo3iifT1RJIBbWA', User.FLAGS.GET_BY_TOKEN)
        //     .then(usr => {

        //         usr.permissions.set(usr.application.id, 1);
        //         usr.permissions.save();
        //     })
        //     .catch(console.error);
    }catch (e)
    {
        console.error(e);
    }
}, 500);