const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const { Client } = require('ssh2');
const concatStream = require('concat-stream');
const { error } = require('console');
const ftp = require("basic-ftp");
const zlib = require('zlib');
const app = express();
const port = 3000;

// try {

//   if (!isEmpty(host)) {

//     if (!isEmpty(username)) {

//       if (!isEmpty(password)) {

//         if (!isEmpty(filesToMove) && filesToMove.length > 0) {
//         }
//         else {
//           res.status(400).json({
//             error: true,
//             message: `Informacion de archivos incorrecta o incompleta`,
//             results: []
//           });
//         }
//       }
//       else {
//         res.status(400).json({
//           error: true,
//           message: `Contraseña invalida o vacia`,
//           results: []
//         });
//       }
//     }
//     else {
//       res.status(400).json({
//         error: true,
//         message: `Usuario invalido o vacio`,
//         results: []
//       });
//     }
//   }
//   else {
//     res.status(400).json({
//       error: true,
//       message: `URL de host invalida o vacio`,
//       results: []
//     });
//   }
// }
// catch (er) {
//   res.status(500).json({
//     error: true,
//     message: `Excepción general en servicio moveFiles: ${JSON.stringify(er)}`,
//     results: []
//   });
// }


app.use(bodyParser.json());

//SERVICIO DE CARGA DE ARCHIVOS EN SERVIDOR SFPT
app.post('/uploadFile', async (req, res) => {
  const serviceName = `uploadFile`;
  const fileName = req[`body`][`fileName`];
  const fileUrl = req[`body`][`fileUrl`];
  const host = req[`body`][`host`];
  const port = req[`body`][`port`];
  const username = req[`body`][`username`];
  const password = req[`body`][`password`];
  const remotePath2 = req[`body`][`remotePath`];
  const respuesta = await axios.get(fileUrl);

  console.log(`77. Service: ${serviceName} | Request Body: ${JSON.stringify(req.body)}`);

  if (!isEmpty(host)) {

    if (!isEmpty(username)) {

      if (!isEmpty(password)) {

        if (!isEmpty(fileName)) {

          if (!isEmpty(fileUrl)) {

            if (!isEmpty(remotePath2)) {

              const client = new ftp.Client();
              client.ftp.verbose = false;

              try {
                await client.access({
                  host: host,
                  user: username,
                  password: password,
                  port: port,
                  secure: true
                });

                // Cambiar a la carpeta deseada (crear si es necesario)
                await client.ensureDir(remotePath2);
                console.log(`95. Host: ${host} - Conexión SFTP ready`);

                //Armado de rutas
                const localPath = `ArchivosTXT/${fileName}`;
                const remotePath = `${remotePath2}${fileName}`;
                require('fs').writeFileSync(localPath, respuesta.data, 'utf-8');
                console.log(`101. Host: ${host} - localPath: ${localPath} - remotePath: ${remotePath}\n`);
                await client.uploadFrom(localPath, remotePath);
                await client.close();

                console.log(`105. Host: ${host} - localPath: ${localPath} - remotePath: ${remotePath}\n`);
                let message = `Host: ${host} - Directorio : ${remotePath} - Nombre archivo: ${fileName} - Archivo cargado exitosamente`;
                return res.status(200).json({
                  error: false,
                  message: message,
                  fileName: fileName
                });

              }
              catch (err) {
                console.error("Error FTPS:", err.message);
                return res.status(500).json({
                  error: "Error al subir archivo",
                  message: err.message,
                  fileName: fileName
                });
              }
            }
            else {
              res.status(400).json({
                error: true,
                message: `Ruta de archivo invalida o vacia`,
                fileName: fileName
              });
            }
          }
          else {
            res.status(400).json({
              error: true,
              message: `URL de archivo invalida o vacia`,
              fileName: fileName
            });
          }
        }
        else {
          res.status(400).json({
            error: true,
            message: `Nombre de archivo invalido o vacio`,
            fileName: fileName
          });
        }
      }
      else {
        res.status(400).json({
          error: true,
          message: `Contraseña invalida o vacia`,
          fileName: fileName
        });
      }
    }
    else {
      res.status(400).json({
        error: true,
        message: `Usuario invalido o vacio`,
        fileName: fileName
      });
    }
  }
  else {
    res.status(400).json({
      error: true,
      message: `URL de host invalida o vacio`,
      fileName: fileName
    });
  }
});

//SERVICIO DE BUSQUEDA DE ARCHIVOS EN SERVIDOR SFPT
app.post('/searchFileEncoded', async (req, res) => {
  const serviceName = `searchFile`;
  const host = req.body.host;
  const port = req.body.port;
  const username = req.body.username;
  const password = req.body.password;
  const filePath = req.body.filePath;

  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  console.log(`141. Servicio: ${serviceName} | Request Body: ${JSON.stringify(req.body)}`);

  try {

    if (!isEmpty(host)) {

      if (!isEmpty(username)) {

        if (!isEmpty(password)) {

          if (!isEmpty(filePath) && filePath.length > 0) {

            const client = new ftp.Client();
            client.ftp.verbose = false;

            await client.access({
              host: host,
              user: username,
              password: password,
              port: port,
              secure: true
            });

            // Verificar tamaño
            const fileSize = await client.size(filePath);
            console.log(`166. Servicio: ${serviceName} | Tamaño de archivo solicitado: ${fileSize}`);
            let fileSizeMb = parseFloat((fileSize / (1024 * 1024)).toFixed(2));

            if (fileSize > MAX_SIZE_BYTES) {
              await client.close();
              return res.status(400).json({
                error: true,
                message: `El archivo excede el tamaño máximo permitido de 10MB (${fileSizeMb}MB)`
              });
            }

            // Leer contenido
            const writableStream = new require('stream').Writable();
            const chunks = [];
            writableStream._write = (chunk, encoding, done) => {
              chunks.push(chunk);
              done();
            };

            await client.downloadTo(writableStream, filePath);
            const contentBuffer = Buffer.concat(chunks);
            //const compressed = zlib.gzipSync(contentBuffer);
            const encodedFileContent = contentBuffer.toString('base64'); // listo para enviar por JSON

            await client.close();
            console.log(`190. Servicio: ${serviceName} | Ejecucion Exitosa`);

            return res.json({
              error: false,
              message: `Servicio Ejecutado con Exito`,
              path: filePath,
              size: fileSizeMb,
              size_string: `${fileSizeMb}MB`,
              content: encodedFileContent
            });

          }
          else {
            res.status(400).json({
              error: true,
              message: `Informacion de archivos incorrecta o incompleta`,
              content: null
            });
          }
        }
        else {
          res.status(400).json({
            error: true,
            message: `Contraseña invalida o vacia`,
            content: null
          });
        }
      }
      else {
        res.status(400).json({
          error: true,
          message: `Usuario invalido o vacio`,
          content: null
        });
      }
    }
    else {
      res.status(400).json({
        error: true,
        message: `URL de host invalida o vacio`,
        content: null
      });
    }
  }
  catch (er) {
    res.status(500).json({
      error: true,
      message: `Excepción general en servicio moveFiles: ${JSON.stringify(er)}`,
      content: null
    });
  }
});

//SERVICIO DE BUSQUEDA DE ARCHIVOS EN SERVIDOR SFPT
app.post('/searchFile', async (req, res) => {
  const serviceName = `searchFile`;
  const host = req.body.host;
  const port = req.body.port;
  const username = req.body.username;
  const password = req.body.password;
  const filePath = req.body.filePath;

  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  console.log(`141. Servicio: ${serviceName} | Request Body: ${JSON.stringify(req.body)}`);

  try {

    if (!isEmpty(host)) {

      if (!isEmpty(username)) {

        if (!isEmpty(password)) {

          if (!isEmpty(filePath) && filePath.length > 0) {

            const client = new ftp.Client();
            client.ftp.verbose = false;

            await client.access({
              host: host,
              user: username,
              password: password,
              port: port,
              secure: true
            });

            // Verificar tamaño
            const fileSize = await client.size(filePath);
            console.log(`166. Servicio: ${serviceName} | Tamaño de archivo solicitado: ${fileSize}`);
            let fileSizeMb = parseFloat((fileSize / (1024 * 1024)).toFixed(2));

            if (fileSize > MAX_SIZE_BYTES) {
              await client.close();
              return res.status(400).json({
                error: true,
                message: `El archivo excede el tamaño máximo permitido de 10MB (${fileSizeMb}MB)`
              });
            }

            // Leer contenido
            const writableStream = new require('stream').Writable();
            const chunks = [];
            writableStream._write = (chunk, encoding, done) => {
              chunks.push(chunk);
              done();
            };

            await client.downloadTo(writableStream, filePath);
            const contentBuffer = Buffer.concat(chunks);
            //const compressed = zlib.gzipSync(contentBuffer);
            const encodedFileContent = contentBuffer.toString('utf-8'); // listo para enviar por JSON

            await client.close();
            console.log(`190. Servicio: ${serviceName} | Ejecucion Exitosa`);

            return res.json({
              error: false,
              message: `Servicio Ejecutado con Exito`,
              path: filePath,
              size: fileSizeMb,
              size_string: `${fileSizeMb}MB`,
              content: encodedFileContent
            });

          }
          else {
            res.status(400).json({
              error: true,
              message: `Informacion de archivos incorrecta o incompleta`,
              content: null
            });
          }
        }
        else {
          res.status(400).json({
            error: true,
            message: `Contraseña invalida o vacia`,
            content: null
          });
        }
      }
      else {
        res.status(400).json({
          error: true,
          message: `Usuario invalido o vacio`,
          content: null
        });
      }
    }
    else {
      res.status(400).json({
        error: true,
        message: `URL de host invalida o vacio`,
        content: null
      });
    }
  }
  catch (er) {
    res.status(500).json({
      error: true,
      message: `Excepción general en servicio moveFiles: ${JSON.stringify(er)}`,
      content: null
    });
  }
});

//SERVICIO DE BUSQUEDA Y MOVIMIENTO DE ARCHIVOS EN SERVIDOR SFPT
app.post('/moveFiles', async (req, res) => {

  const host = req.body.host;
  const port = req.body.port;
  const username = req.body.username;
  const password = req.body.password;
  const filesToMove = req.body.filesToMove; // Array de objetos { name, sourcePath, destinationPath }

  console.log(`252. host: ${host} - port: ${port} - username: ${username} - password: ${password}\n`);
  console.log(`253. Archivos a mover: ${JSON.stringify(filesToMove)}`);

  try {

    if (!isEmpty(host)) {

      if (!isEmpty(username)) {

        if (!isEmpty(password)) {

          if (!isEmpty(filesToMove) && filesToMove.length > 0) {

            const client = new ftp.Client();
            client.ftp.verbose = false;

            try {
              await client.access({
                host: host,
                user: username,
                password: password,
                port: port,
                secure: true
              });

              const resultados = [];

              for (const file of filesToMove) {
                const { name, sourcePath, destinationPath } = file;

                const sourceFull = `${sourcePath.replace(/\/$/, '')}/${name}`;
                const destinationFull = `${destinationPath.replace(/\/$/, '')}/${name}`;

                try {
                  // Verifica que el destino exista
                  await client.cd(destinationPath);

                  // Regresa al origen antes de mover (precaución si CD afecta contexto)
                  await client.cd('/');
                  await client.rename(sourceFull, destinationFull);

                  resultados.push({
                    file: name,
                    from: sourcePath,
                    to: destinationPath,
                    moved: true
                  });
                } catch (err) {
                  resultados.push({
                    file: name,
                    from: sourcePath,
                    to: destinationPath,
                    moved: false,
                    error: err.message
                  });
                }
              }

              await client.close();

              return res.json({
                error: false,
                message: `Servicio ejecutado con exito`,
                results: resultados
              });
            }
            catch (e) {
              res.status(500).json({
                error: true,
                message: `Excepción general en servicio moveFiles: ${JSON.stringify(e)}`,
                results: []
              });
            }
          }
          else {
            res.status(400).json({
              error: true,
              message: `Informacion de archivos incorrecta o incompleta`,
              results: []
            });
          }
        }
        else {
          res.status(400).json({
            error: true,
            message: `Contraseña invalida o vacia`,
            results: []
          });
        }
      }
      else {
        res.status(400).json({
          error: true,
          message: `Usuario invalido o vacio`,
          results: []
        });
      }
    }
    else {
      res.status(400).json({
        error: true,
        message: `URL de host invalida o vacio`,
        results: []
      });
    }
  }
  catch (er) {
    res.status(500).json({
      error: true,
      message: `Excepción general en servicio moveFiles: ${JSON.stringify(e)}`,
      results: []
    });
  }
});

//SERVICIO DE BUSQUEDA DE ARCHIVOS EN SERVIDOR SFPT
app.post('/deleteFiles', async (req, res) => {

  const host = req.body.host;
  const port = req.body.port;
  const username = req.body.username;
  const password = req.body.password;
  const filesToDelete = req.body.filesToDelete; // Array de objetos { name, remotePath }

  console.log(`376. host: ${host} - port: ${port} - username: ${username} - password: ${password}\n`);
  console.log(`377. Archivos a eliminar: ${JSON.stringify(filesToDelete)}`);

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: host,
      user: username,
      password: password,
      port: port,
      secure: true
    });

    const resultados = [];

    for (const file of filesToDelete) {
      const { name, remotePath } = file;

      try {
        await client.cd(remotePath);
        await client.remove(name);
        resultados.push({ file: name, remotePath: remotePath, deleted: true });
      } catch (err) {
        resultados.push({
          file: name,
          remotePath: remotePath,
          deleted: false,
          error: err.message
        });
      }
    }

    await client.close();

    return res.json({
      results: resultados
    });
  }
  catch (e) {
    let message = `Excepción general en servicio deleteFiles: ${JSON.stringify(e)}`;
    res.status(500).json({
      error: true,
      message: message,
      results: null
    });

    return;
  }
});

//SERVICIO DESTINADO A PROBAR LA DISPONIBLIDAD DE LA APLICACION
app.get("/", (req, res) => {
  res.json({
    Status: 'OK'
  })
});

//INICIAR SERVIDOR
app.listen(port, () => {
  console.log(`438. Servidor escuchando en http://localhost:${port}`);
});

let isEmpty = (value) => {

  if (value === ``)
    return true;

  if (value === null)
    return true;

  if (value === undefined)
    return true;

  if (value === `undefined`)
    return true;

  if (value === `null`)
    return true;

  return false;
}