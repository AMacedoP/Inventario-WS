'use strict';
var express = require('express');
var bodyparser = require('body-parser');
var app = express();
var propertiesReader = require('properties-reader');
var mysql = require('mysql');
// Sha-256
var sha256 = require('js-sha256');
// Configuracion conexion a base de datos
var properties = propertiesReader('dbConnection.properties');

var db = mysql.createConnection({
    host: properties.get('db.host').toString(),
    port: properties.get('db.port').toString(),
    user: properties.get('db.user').toString(),
    password: properties.get('db.password').toString(),
    database: properties.get('db.database').toString()
})

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({
    extended: true
}));

// Crear un token y ponerlo en el usuario
function crearToken(usuario, callback){
    const min = 100;
    const max = 999999;
    var randomInt = Math.random() * (max - min) + min;
    var token = sha256(randomInt.toString());

    db.query('UPDATE Autenticación SET token = ?, dateCreated = NOW(),\
    validToken = 1 Where usuario = ?', [token, usuario],
    function(error, results, fields){
        if(error){
            callback('-1');
            throw error;
        }
        callback(token);
    });
}

// Validar el token
function validaToken(token, callback){
    db.query('SELECT * FROM Autenticación WHERE token = ?\
    AND TIMESTAMPDIFF(MINUTE, dateCreated, NOW()) < 30 AND validToken = 1;',
    token, function(error, results, fields){
        if(error) throw error;
        if(results.length == 1) callback(true);
        if(results.length == 0) callback(false);
    });
}

// Listar el inventario (GET)
app.get('/inventario',function(req, res){
    let token = req.query.token;
    validaToken(token, function(esValido){
        if(!esValido) return res.send({error: 1, message: 'Token no válido'});
        db.query('SELECT idModelo as id, nombreMarca as marca, nombreModelo as modelo,\
        nombreSubtipo as subtipo, v.stock, v.precio, v.anio as año FROM Modelo m,\
        Subtipo s, Marca ma, Vehiculo v WHERE v.idSubtipo = s.idSubtipo and\
        v.idModelo = m.idModelo and m.idModelo = v.idModelo',
        function(error, results, fields){
            if (error) throw error;
            return res.send({error: 0, results: results, message: 'Realizado'});
        });
    });
});

// Filtrar vehiculo (GET)
app.get('/inventario/filtrar', function(req, res){
    let token = req.query.token;
    let marca = req.query.marca;
    let modelo = req.query.modelo;
    let subtipo = req.query.subtipo;
    let precioMin = req.query.precioMin;
    let precioMax = req.query.precioMax;
    let año = req.query.año;
    validaToken(token, function(esValido){
        if(!esValido) return res.send({error: 1, message: 'Token no válido'});
        var query='SELECT idModelo as id, nombreMarca as marca, nombreModelo as modelo,\
        nombreSubtipo as subtipo, v.stock, v.precio, v.anio as año FROM Modelo m,\
        Subtipo s, Marca ma, Vehiculo v WHERE v.idSubtipo = s.idSubtipo and\
        m.idModelo = v.idModelo and m.idMarca = ma.idMarca';
        if (marca) query = query + "and ma.nombreMarca = '" + marca + "' ";
        if (modelo) query = query + "and m.nombreModelo = '" + modelo + "' ";
        if (subtipo) query = query + "and s.nombreSubtipo = '" + subtipo + "' ";
        if (precioMin) query = query + 'and v.precio >= ' + precioMin;
        if (precioMax) query = query + 'and v.precio <= ' + precioMax;
        if (año) query = query + 'and v.anio = ' + año;
        db.query(query, function(error , results, fiels){
            if (error) throw error;
            return res.send({error: 0, data: results, message: 'Realizado'});
        });
    });
});

// Detallar vehiculo (GET)
app.get('/inventario/detallar', function(req, res){
    let token = req.query.token;
    let idAuto = req.query.idAuto;
    if(idAuto == null) return res.send({error: 3, message: 'No se ha insertado Id del auto'});
    console.log(idAuto);
    validaToken(token, function(esValido){
        if(!esValido) return res.send({error: 1, message: 'Token no válido'});
        db.query("SELECT nombreMarca as marca, nombreModelo as modelo,\
        nombreSubtipo as subtipo, v.stock, v.precio, v.anio as año,\
        tipoTransmision, ubicacion, airbag,\
        tipoDeLuces, color, motor, tipoDeFrenos, fotos as imagenes\
        FROM Modelo m, Subtipo s, Marca ma, Vehiculo v WHERE v.idSubtipo = s.idSubtipo\
        and and m.idModelo = v.idModelo and m.idMarca = ma.idMarca and v.idVehiculo = ?;",
        idAuto, function(error, results, fields){
            if (error) throw error;
            return res.send({error: 0, data: results, message:'Realizado'});
            console.log(Auto_ID);
        });
    });
});

// Validar usuario (POST)
app.post('/validarUsuario', function(req, res){
    let usuario = req.body.usuario;
    let password = req.body.password;

    db.query('SELECT * FROM Autenticación WHERE usuario = ? AND password = ?',
    [usuario, password], function(error, results, fields){
        if(results.length == 1) crearToken(usuario, function(token){
            return res.send({error: 0, token: token, message: 'Token creado con éxito'});
        })
        if(results.length == 0) return res.send({error: 2, message: 'Usuario o contraseña no válido'});
    });
})

// Reservar auto (PUT)
app.put('/inventario/reservarAuto', function(req, res){
    let token = req.body.token;
    let idAuto = req.body.idAuto;
    if(idAuto == null) return res.send({error: 3, message: 'No se ha insertado Id del auto'});
    validaToken(token, function(esValido){
        if(!esValido) return res.send({error: 1, message: 'Token no válido'});
        db.query("UPDATE Vehiculo SET stock = stock - 1 WHERE idVehiculo = ?;",
        idAuto, function(error, results, fields){
            if (error) throw error;
            return res.send({error: 0, message:'Auto reservado correctamente'});
        });
    });
});

// Eliminar reserva de auto (PUT)
app.put('/inventario/eliminarReservarAuto', function(req,res){
    let token = req.body.token;
    let idAuto = req.body.idAuto;
    if(idAuto == null) return res.send({error: 3, message: 'No se ha insertado Id del auto'});
    validaToken(token, function(esValido){
        if(!esValido) return res.send({error: 1, message: 'Token no válido'});
        db.query("UPDATE Vehiculo SET stock = stock + 1 WHERE idVehiculo = ?;",
        idAuto, function(error, results, fields){
            if(error) throw error;
            return res.send({error: 0, message: 'Reserva del auto eliminada correctamente'});
        });
    });
});

// Empezar server
app.listen(3000, function(){
    console.log('El servidor esta escuchando en el puerto 3000');
});
