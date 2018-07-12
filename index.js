var http = require('http');
var createHandler = require('github-webhook-handler');
var handler = createHandler({ path: '/webhook', secret: 'supersecret' });
const gitP = require('simple-git/promise');
const fs = require('fs');
const {spawn} = require('child_process');

const procs = {};

const run = (...args) => {

    const spawned = spawn(...args);

    spawned.stdout.on('data', function (data) {
          console.log(data.toString());
    });

    spawned.stderr.on('data', function (data) {
          console.log(data.toString());
    });

    spawned.on('exit', function (code) {
          console.log('child process exited with code ' + (code ? code.toString(): 'null'));
          delete procs[spawned.pid];
    });

    return spawned;
}

async function handlePush(repo) {
    const repoId = repo.name;

    if (procs[repoId])  {
        try {  
            process.kill(-procs[repoId].pid);
        } catch(e) {
            console.error('could not kill old process', e);
        }
    }

    const dir = __dirname + '/repos/' + repo.name;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    const git = gitP(dir);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
        await git.init();
        await git.addRemote('origin', repo.html_url);
    }
    const update = await git.pull('origin', repo.default_branch);


    procs[repoId] = run('sh', ['deploy.sh'], {cwd: dir, detached: true});
}

http.createServer(function (req, res) {
        handler(req, res, function (err) {
                res.statusCode = 404
                res.end('no such location')
                })
        }).listen(7777)

handler.on('error', function (err) {
        console.error('Error:', err.message)
        })

handler.on('push', function (event) {
        console.log('Received a push event for %s to %s',
                event.payload.repository.name,
                event.payload.ref)
        handlePush(event.payload.repository);
        })

handler.on('issues', function (event) {
        console.log('Received an issue event for %s action=%s: #%d %s',
                event.payload.repository.name,
                event.payload.action,
                event.payload.issue.number,
                event.payload.issue.title)
        }) 