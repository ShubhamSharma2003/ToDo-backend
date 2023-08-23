const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');


const salt = 10;

const app = express();
app.use(express.json());
app.use(cors(
    {
    origin:["http://localhost:5173"],
    methods: ["POST","GET","PUT", "DELETE"],
    credentials:true,
}
));

app.use(cookieParser());

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password:"macbook2003",
    database:"signup"
});

const verifyUser = (req,res,next) =>{
    const token = req.cookies.token;
    if(!token){
        return res.json({Error: "You are not Authenticated"})
    }else {
        jwt.verify(token,"jwt-secret-key", (err,decoded) =>{
            if(err){
                return res.json({Error: "Token is not okay"})
            }else{
                req.user = {name: decoded.name, email: decoded.email, id:decoded.id};
                next();
            }
        })
    }
}


app.get('/', verifyUser ,(req,res) => {
    return res.json({Status:"Success", name: req.name})
})

app.post('/register', (req,res) => {
    const sql = "INSERT INTO login (`name`,`email`,`password`) VALUES (?)";
    bcrypt.hash(req.body.password.toString(), salt,(err, hash) => {
        if(err) return res.json({Error: "Error hashing password"});
   
        const values = [
            req.body.name,
            req.body.email,
            hash
        ]

        db.query(sql,[values], (err,result) => {
            if(err){
                return res.json({Error:" Inserting data error in server"});
            }
            return res.json({Status:" Success "});
        })
    })
})


app.post('/login',(req,res) => {
    const sql = 'SELECT * FROM login WHERE email = ?';
    db.query(sql, [req.body.email], (err,data) => {
        if(err) return res.json({Error: "login error in server"});
        if(data.length > 0){
            bcrypt.compare(req.body.password.toString(), data[0].password, (err, response) => {
                if(err) return res.json({ Error:" Password compare error"});
                if(response){
                    const name = data[0].name;
                    const id = data[0].id;
                    const email = data[0].email;
                    const token = jwt.sign({name, id, email},"jwt-secret-key", {expiresIn:'1d'});
                    res.cookie('token',token);
                    return res.json({Status:"Success", token, id, email })
                }else{
                    return res.json({Error:"Password did not match"})
                }
            })

        }else{
            return res.json({Error:"No email existed"})
        }
    })
})

//-------------------------------------------------------------------------------------------

//for todo database
app.post('/todo', verifyUser, (req, res) => {
    const { text } = req.body;
    console.log(req.user);
    
    const newTodo = {
      user_id: req.user.id, 
      text: text
    };
    console.log(text);
  
    const sql = 'INSERT INTO todos SET ?';
    db.query(sql, [newTodo], (err, result) => {
      if (err) {
        return res.json({ Error: 'Error adding todo to the database' });
      }
      return res.json({ Status: 'Success', id: result.insertId });
    });
  });

//-------------------------------------------------------------------------------------------

//todo datewise fetching from the db
    app.get('/todos', verifyUser, (req, res) => {
    const userId = req.query.id; 
  
    const sql = `
      SELECT id, DATE(created_at) AS date, GROUP_CONCAT(text) AS todos, Status
      FROM todos
      WHERE user_id = ?
      GROUP BY DATE(created_at), id, Status
      ORDER BY DATE(created_at) DESC;
    `;
  
    db.query(sql, [userId], (err, results) => {
      if (err) {
        return res.status(500).json({ Error: 'Error fetching todos from the database' });
      }
      
    const todosByDate = results.map(row => ({
        id: row.id,
        date: row.date,
        todos: row.todos.split(','),
        status: row.Status
    }));
      const temp = {}
      const temp_1= []
      for(let val of todosByDate){
        if(temp[val.date]){
            temp[val.date].push({id:val.id,todo:val.todos[0],status:val.status})
        }else{
            temp[val.date] = [{id:val.id,todo:val.todos[0],status:val.status}]
        }
      }
     
      return res.json({ Status: 'Success', "data": temp });
    });
});

//-------------------------------------------------------------------------------------------

//marking the todos as completed 
app.put('/mark/todo/completed', verifyUser, (req, res) => {
    const { body } = req;
    const { id } = body;
    
    //console.log(body);
    // console.log(id);
    
    const sql = 'UPDATE todos SET Status = ? WHERE id = ?  ';
    db.query(sql, ['completed', id ], (err, result) => {
      if (err) {
        return res.json({ Error: 'Error marking todo as completed' });
      }
      return res.json({ Status: 'Todo marked as completed' });
    });
  });

//-------------------------------------------------------------------------------------------

// Remove a todo from the database
app.delete('/todo/:id', verifyUser, (req, res) => {
    const todoId = req.params.id;
    
    const sql = 'DELETE FROM todos WHERE id = ?';
    db.query(sql, [todoId], (err, result) => {
        if (err) {
            return res.json({ Error: 'Error removing todo from the database' });
        }
        return res.json({ Status: 'Todo removed from the database' });
    });
});

//-------------------------------------------------------------------------------------------

// Edit a todo in the database
app.put('/todo/:id', verifyUser, (req, res) => {
    const todoId = req.params.id;
    const updatedText = req.body.updatedText;
    const sql = 'UPDATE todos SET text = ? WHERE id = ?';
    
    db.query(sql, [updatedText, todoId], (err, result) => {
      if (err) {
        return res.json({ Error: 'Error updating todo in the database' });
      }
      return res.json({ Status: 'Todo updated in the database' });
    });
});

//-------------------------------------------------------------------------------------------
//logout 
app.get('/logout', (req,res) => {
    res.cookie('token',"");
    return res.json({Status:"Successfully logged out"});
})

//-------------------------------------------------------------------------------------------

//server listening
app.listen(8081, () => {
    console.log("Running...")
})
