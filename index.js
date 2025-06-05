const express = require('express');
const hbs = require('hbs');
const waxOn = require('wax-on');
// setup waxOn on handlebars
waxOn.on(hbs.handlebars);
// tell waxOn where to find our layouts
waxOn.setLayoutPath("./views/layouts");

require('dotenv').config();

// use the version of mysql2 that supports promise
// promises here tldr: await/async (you wait for a promise)
const mysql = require('mysql2/promise');

const app = express();

async function main() {
    let connection = await mysql.createConnection({
        'host': process.env.DB_POST, // host means server, in this case using the host ip address
        'user': process.env.DB_USER, // database user
        'database': process.env.DB_DATABASE,
        'password': process.env.DB_PASSWORD 

    })

    app.get('/', function(req, res){
        const luckyNumber = Math.floor(Math.random()*1000 + 1);
        // by default res.render assumes that the file path is related to the views folder
        res.render('index', {
            'lucky': luckyNumber
        });
    })
    
    app.get('/customers', async function(req, res) {
        // connection.execute will return an array
        // but only index 0 contains the rows data
        // the other indexes contain meta data
        // square bracket indicates array destructuring
        // same as
        // let results = await connection.execute('...')
        // let customers = results[0];
        let [customers] = await connection.execute(`
            SELECT * FROM Customers JOIN Companies
            ON Customers.company_id = Companies.company_id
            `);
            res.render('customers/index', {
                customers:customers
            });
        })
    
    app.get('/about-us', function(req, res){
        res.render('about-us')
    })
    
    app.get('/contact-us', function(req, res){
        res.render('contact-us')
    
    })

}
main();

// use hbs as our 'view engine'
app.set('view engine', 'hbs')



app.listen(3000, function(){
    console.log("Express server has started")
})