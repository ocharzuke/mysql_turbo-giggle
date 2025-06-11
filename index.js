const express = require('express');
const hbs = require('hbs');
const waxOn = require('wax-on');
// setup waxOn on handlebars
waxOn.on(hbs.handlebars);
// tell waxOn where to find our layouts
waxOn.setLayoutPath("./views/layouts");

// setup handlebars helpers
const helpers = require('handlebars-helpers');
helpers({ 
    'handlebars': hbs.handlebars
})

require('dotenv').config();

// use the version of mysql2 that supports promise
// promises here tldr: await/async (you wait for a promise)
const mysql = require('mysql2/promise');

const app = express();

// use hbs as our 'view engine'
app.set('view engine', 'hbs')
app.use(express.urlencoded({
    extended: true // true allows forms to contain arrays and objects
}))

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

        const { first_name, last_name } = req.query;

        let basicQuery = `SELECT * FROM Customers JOIN Companies ON Customers.company_id = Companies.company_id WHERE 1`

        const bindings = [];

        // if the user enters a first name, modify the basic query
        // by appending WHERE at the back to search for it

        if (first_name) {
            basicQuery = basicQuery + " AND first_name = ?";
            bindings.push(first_name);
        }

        if (last_name) {
            basicQuery = basicQuery + " AND last_name = ?";
            bindings.push(last_name);
        }

        console.log(basicQuery);

        // connection.execute will return an array
        // but only index 0 contains the rows data
        // the other indexes contain meta data
        // square bracket [] indicates array destructuring
        // same as
        // let results = await connection.execute('...')
        // let customers = results[0];

        let [customers] = await connection.execute(basicQuery, bindings);
        res.render('customers/index', {
            customers: customers,
            first_name, last_name
        });
    })

        app.get('/customers/create', async function (req,res) {
            const [companies] = await connection.execute(`SELECT company_id, name FROM Companies`);
            const [employees] = await connection.execute(`SELECT employee_id, first_name, last_name FROM Employees`);
            
            res.render('customers/create', {
                companies: companies,
                employees: employees
            });
        })

  
        app.post('/customers/create', async function (req, res) {

            try {
                await connection.beginTransaction();
                const {first_name, last_name, rating, company_id} = req.body;
                const sql = `INSERT INTO Customers (first_name, last_name, rating, company_id) VALUES (?, ?, ?, ?);`
                const bindings = [first_name, last_name, rating, company_id];
                // prepared statements - defence against SQL injection
                // in case a hacker writes sql code as the first_name to hack into the system
                // we want to tell sql to take the input literally as a string and not as sql code
                // basically take it strictly as data and not sql code
                const [results] = await connection.execute(sql, bindings);

                // get the primary key (aka the customer_id) of the newly created customer
                const customerId = results.insertId;
                
                if (req.body.employees) {
                    for (let employee of req.body.employees) {
                        const sql = `INSERT INTO EmployeeCustomer (employee_id, customer_id) VALUES (?,?)`;
                        const bindings = [employee, customerId];
                        await connection.execute(sql, bindings)
                    }
                }
                
            await connection.commit(); // changes to the database are finalised
            res.redirect('/customers'); // tells browser to go to send a URL
            
        } catch (e) {
            await connection.rollback(); // undo every change done so far
            res.redirect('/customers');
        }
    })
    
    app.get('/customers/:id/update', async function(req, res){
    const customerId = req.params.id;
    const [rows] = await connection.execute(`SELECT * FROM Customers WHERE customer_id = ?`, [customerId]);
    const [companies] = await connection.execute(`SELECT * FROM Companies`);
    const [employees] = await connection.execute(`SELECT * FROM Employees`);
    const [currentEmployees] = await connection.execute(`SELECT * FROM EmployeeCustomer WHERE customer_id = ?`, [customerId]);
    const currentEmployeeIDs = currentEmployees.map(employee => employee.employee_id);

    res.render('customers/update', {
        customer: rows[0],
        companies,
        employees,
        currentEmployeeIDs
    });
})

app.post('/customers/:id/update', async function (req, res) {
    try {
        await connection.beginTransaction();

        const customerId = req.params.id;
        const { first_name, last_name, rating, company_id } = req.body;

        await connection.execute(`
            UPDATE Customers SET first_name=?, last_name=?, rating=?, company_id=?
            WHERE customer_id = ?`, [first_name, last_name, rating, company_id, customerId]);

            // for updating many-to-many relationships
            // 1. delete all existing relationships
            // 2. re-insert the relationships based on the form
            await connection.execute(`DELETE FROM EmployeeCustomer WHERE customer_id = ?`, [customerId]);

            if (req.body.employees) {
                for (let employee of req.body.employees) {
                    const sql = `INSERT INTO EmployeeCustomer (employee_id, customer_id) VALUES (?,?)`;
                    const bindings = [employee, customerId];
                    await connection.execute(sql, bindings);
                }
            }

            await connection.commit();
            res.redirect('/customers');
        } catch (e) {
            await connection.rollback();
            res.redirect('/customers');
        }
    })

    // dynamic web apps dont support delete so must use get
    // there are bots that crawl through webpages to get info
    // get routes will be susceptible to bots
    // should get the customer to confirm that he/she wants to delete first
    app.get('/customers/:id/delete', async function(req, res){
        const customerId = req.params.id;
        const [rows] = await connection.execute(`SELECT * FROM Customers WHERE customer_id = ?`, [customerId]);
        const customer = rows[0];
        res.render('customers/delete', {
                customer
        })
    })

    app.post('/customers/:id/delete', async function (req, res){
        try {
            const customerId = req.params.id;
            await connection.execute("DELETE FROM Sales WHERE customer_id = ?", [customerId]);
            await connection.execute("DELETE FROM EmployeeCustomer WHERE customer_id = ?", [customerId]);
            await connection.execute(`DELETE FROM Customers WHERE customer_id = ?`, [customerId]);
            res.redirect('/customers');
        } catch (e) {
            console.log(e);
            res.send("Delete failed due to existing relationship. Press [BACK] and try again")
        }
    })
            
        app.get('/about-us', function (req, res){
            res.render('about-us')
        })
        
        app.get('/contact-us', function (req, res){
            res.render('contact-us')
        })

        app.get('/employees', async function (req, res) {
            const [employees] = await connection.query(`SELECT * FROM Employees JOIN Departments ON Employees.department_id = Departments.department_id`);

            res.render('employees/index', {
                employees
            })
        });

        app.get('employees/create', async function (req, res) {
            const [departments] = await connection.execute(`SELECT * FROM Departments`);
            res.render('employees/create', {
                departments
            })
        })

        app.post('/employees/create', async function (req, res) {
            try {
            const bindings = [req.body.first_name, req.body.last_name, req.body.department_id];
            await connection.execute(`INSERT INTO Employees (first_name, last_name, department_id)
        VALUES (?, ?, ?)`, bindings);
            } catch (e) {
                console.log(e);
            } finally { // finally happens regardless of whether try or catch execute
                res.redirect('/employees')
            }
            
        })

    }
    
    main();
    
    app.listen(3000, function(){
    console.log("Express server has started")
})