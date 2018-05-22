'use strict';
var express = require('express');
var bodyparser = require('body-parser');
var app = express();
var propertiesReader = require('properties-reader');


var mysql = require('mysql');

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

//listar inventario
app.get('/inventario',function(req, res){
    db.query('SELECT idModelo as id, nombreMarca as marca, nombreModelo as modelo,\
    nombreSubtipo as subtipo, v.stock as cantidad, v.precio, v.anio as año FROM Modelo m,\
    Subtipo s, Marca ma, Vehiculo v WHERE m.Subtipo_idSubtipo = s.idSubtipo and\
    s.Marca_idMarca = ma.idMarca and m.idModelo = v.Modelo_idModelo',
    function(error, results, fields){
        if (error) throw error;
        return res.send({error: 'false', results: results, message:'esta cosa funciona'});
    });
});

//filtrar vehiculo
app.get('/inventario/filtrar', function(req, res){
    let token = req.query.token; //falta añadir la parte de token
    let marca = req.query.marca;
    let modelo = req.query.modelo;
    let subtipo = req.query.subtipo;
    let precioMin = req.query.precioMin;
    let precioMax = req.query.precioMax;
    let año = req.query.año;
    var query='SELECT idModelo as id, nombreMarca as marca, nombreModelo as modelo,\
    nombreSubtipo as subtipo, v.stock as cantidad, v.precio, v.anio as año FROM Modelo m,\
    Subtipo s, Marca ma, Vehiculo v WHERE m.Subtipo_idSubtipo = s.idSubtipo and\
    s.Marca_idMarca = ma.idMarca and m.idModelo = v.Modelo_idModelo;';
    if (marca) query = query + "and ma.nombreMarca = '" + marca + "' ";
    if (modelo) query = query + "and m.nombreModelo = '" + modelo + "' ";
    if (subtipo) query = query + "and s.nombreSubtipo = '" + subtipo + "' ";
    if (precioMin) query = query + 'and v.precio >= ' + precioMin;
    if (precioMax) query = query + 'and v.precio <= ' + precioMax;
    if (año) query = query + 'and v.anio = ' + año;
    db.query(query, function(error , results, fiels){
        if (error) throw error;
        return res.send({error: false, data: results, message:'Esto creo que si funciona'});
    });
});

//detallar un vehiculo
app.get('/inventario/detallar', function(req, res){
    let Auto_ID=req.query.Auto_ID;
    console.log(Auto_ID);
    db.query("SELECT nombreMarca as marca, nombreModelo as modelo,\
    nombreSubtipo as subtipo, v.stock as cantidad, v.precio, v.anio as año,\
    tipoTransmision, ubicacion, ubicacion, airbag, pestillosElectricos, aireAcondicionado,\
    tipoDeLuces, color, traccion, motor, tipoDeFrenos, combustible, foto as imagenes\
    FROM Modelo m, Subtipo s, Marca ma, Vehiculo v WHERE m.Subtipo_idSubtipo = s.idSubtipo\
    and s.Marca_idMarca = ma.idMarca and m.idModelo = v.Modelo_idModelo and m.idModelo = ?;",
    Auto_ID, function(error, results, fields){
        if (error) throw error;
        return res.send({error: false, data: results, message:'Esto creo que si funciona'});
        console.log(Auto_ID);
    });
});

//validar usuario TO BE CONTINUED=> https://www.youtube.com/watch?v=G65pvuTFR_A

//reservar auto
app.put('/inventario/reservarAuto', function(req, res){
    let token = req.body.token;   //falta la parte del token
    let Auto_ID = req.body.Auto_ID;
    console.log(Auto_ID);
    db.query("UPDATE Vehiculo SET stock = stock - 1 WHERE Modelo_idModelo = ?;",
    Auto_ID, function(error, results, fields){
        if (error) throw error;
        return res.send({error:false, data:results, message:'Aber'});
    })
});

//eliminar reserva de auto
app.put('/inventario/eliminarReservarAuto', function(req,res){
    let token = req.body.token;   //falta la parte del token
    let Auto_ID = req.body.Auto_ID;
    console.log(Auto_ID);
    db.query("UPDATE Vehiculo SET stock=stock+1 WHERE Modelo_idModelo=?;",
    Auto_ID, function(error, results, fields){
        if (error) throw error;
        return res.send({error:false, data:results, message:'Aber'});
    })
});

//empieza a funcionar el servidor
app.listen(3000, function(){
    console.log('Esta cosa esta funcionando');
});
