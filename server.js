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

// Validar token estático
function validaTokenEst(token, user, callback){
    db.query('SELECT * FROM Autenticación WHERE token = ? AND usuario = ?',
    [token, user], function(error, results, fields){
        if(error) throw error;
        if(results.length == 1) callback(true);
        if(results.length == 0) callback(false);
    });
}

// Listar el inventario (GET)
//app.get('/inventario',function(req, res){
//    let token = req.header('token');
//    validaTokenEst(token, 'filtrar', function(esValido){
//        if(esValido === false) return res.send({error: 1, message: 'Token no válido'});
//        db.query('SELECT v.idVehiculo as id, ma.nombreMarca as marca, m.nombreModelo as modelo,\
//        s.nombreSubtipo as subtipo, v.stock, v.precio, v.anio as año, v.fotos FROM Modelo m,\
//        Subtipo s, Marca ma, Vehiculo v WHERE v.idSubtipo = s.idSubtipo and\
//        v.idModelo = m.idModelo and m.idModelo = v.idModelo and m.idMarca = ma.idMarca;',
//        function(error, results, fields){
//            if (error) throw error;
//            var i;
//            for (i = 0; i < results.length; i++){
//                results[i].fotos = JSON.parse(results[i].fotos);
//            }
//            return res.send({error: 0, results: results, message: 'Realizado'});
//        });
//    });
//});

// Filtrar vehiculo (GET)
app.get('/inventario', function(req, res){
    let token = req.header('token');
    let numPag = parseInt(req.query.numPag);
    let marca = req.query.marca;
    let modelo = req.query.modelo;
    let subtipo = req.query.subtipo;
    let precioMin = req.query.precioMin;
    let precioMax = req.query.precioMax;
    let añoMin = req.query.añoMin;
    let añoMax = req.query.añoMax;
    validaTokenEst(token, 'filtrar', function(esValido){
        if(!esValido) return res.send({error: 1, message: 'Token no válido'});
        var query='SELECT v.idVehiculo as id, ma.nombreMarca as marca,\
        m.nombreModelo as modelo, s.nombreSubtipo as subtipo, v.stock, v.precio, v.anio as año,\
        v.color, v.fotos FROM Modelo m, Subtipo s, Marca ma, Vehiculo v WHERE v.idSubtipo = s.idSubtipo and\
        m.idModelo = v.idModelo and m.idMarca = ma.idMarca ';
        if (marca) query = query + "and ma.nombreMarca = '" + marca + "' ";
        if (modelo) query = query + "and m.nombreModelo = '" + modelo + "' ";
        if (subtipo) query = query + "and s.nombreSubtipo = '" + subtipo + "' ";
        if (precioMin) query = query + 'and v.precio >= ' + precioMin;
        if (precioMax) query = query + 'and v.precio <= ' + precioMax;
        if (añoMin) query = query + 'and v.anio >= ' + añoMin;
        if (añoMax) query = query + 'and v.anio <= ' + añoMax;
        query = query + "ORDER BY v.idVehiculo";
        db.query(query, function(error , results, fiels){
            if (error) throw error;
            var numPags = Math.floor(results.length/10);
            var startElement = (numPag-1)*10;
            results = results.slice(startElement, startElement+10);
            for (var i = 0; i < results.length; i++){
                results[i].fotos = JSON.parse(results[i].fotos);
            }
            return res.send({error: 0, numPags: numPags, results: results, message: 'Realizado'});
        });
    });
});

// Detallar vehiculo (GET)
app.get('/inventario/detallar', function(req, res){
    let token = req.header('token');
    let idAuto = parseInt(req.query.idAuto);
    if(idAuto == null) return res.send({error: 3, message: 'No se ha insertado Id del auto'});
    validaTokenEst(token, 'filtrar', function(esValido){
        if(!esValido) return res.send({error: 1, message: 'Token no válido'});
        db.query("SELECT v.idVehiculo as id, ma.nombreMarca as marca, m.nombreModelo as modelo,\
        s.nombreSubtipo as subtipo, v.stock, v.precio, v.anio as año,\
        v.tipoTransmision, v.ubicacion, v.airbag,\
        v.tipoDeLuces, v.color, v.motor, v.tipoDeFrenos, v.fotos\
        FROM Modelo m, Subtipo s, Marca ma, Vehiculo v WHERE v.idSubtipo = s.idSubtipo and v.idMarca = ma.idMarca \
        and m.idModelo = v.idModelo and m.idMarca = ma.idMarca and v.idVehiculo = ?",
        idAuto, function(error, results, fields){
            if (error) throw error;
            for (var i = 0; i < results.length; i++){
                results[i].fotos = JSON.parse(results[i].fotos);
            }
            return res.send({error: 0, results: results, message:'Realizado'});
        });
    });
});

// Listar todas las marcas (GET)
app.get('/listarMarcas', function(req, res) {
    let token = req.header('token');
    validaTokenEst(token, 'filtrar', function(validToken){
        if(validToken === false){
            return res.send({error: 1, message: 'Token no válido'});
        }
        db.query("SELECT nombreMarca FROM Marca",
        function(error, results, fields) {
            if(error) throw error;
            var marcas = [];
            for(var index in results){
                marcas.push(results[index].nombreMarca);
            }
            results = JSON.parse(JSON.stringify(marcas));
            return res.send({error: 0, results: results, message: 'Realizado'});
        });
    });
});

// Listar los modelos de una marca (GET)
app.get('/listarModelos', function(req, res) {
    let token = req.header('token');
    let marca = req.query.marca;
    validaTokenEst(token, 'filtrar', function(validToken){
        if (validToken == false) return res.send({error: 1, message: 'Token no válido'});
        db.query("SELECT mo.nombreModelo FROM Modelo mo, Marca m WHERE mo.idMarca = m.idMarca AND m.nombreMarca = ?",
        marca, function(error, results, fields) {
            if(error) throw error;
            var modelos = [];
            for(var index in results){
                modelos.push(results[index].nombreModelo);
            }
            results = JSON.parse(JSON.stringify(modelos));
            return res.send({error: 0, results: results, message: 'Realizado'});
        });
    });
});

// Listar todos los subtipos
app.get('/listarSubtipos', function(req, res) {
    let token = req.header('token');
    validaTokenEst(token, 'filtrar', function(validToken){
        if (validToken == false) return res.send({error: 1, message: 'Token no válido'});
        db.query("SELECT idSubtipo as id, nombreSubtipo as nombre, foto FROM Subtipo;",
        function(error, results, fields) {
            if(error) throw error;
            return res.send({error: 0, results: results, message: 'Realizado'});
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

// Reservar auto (POST)
app.post('/inventario/reservarAuto', function(req, res){
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

// Eliminar reserva de auto (POST)
app.post('/inventario/eliminarReservarAuto', function(req,res){
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
