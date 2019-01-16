module.exports = function (req, res, next) {
  res.sseSetup = function() {

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })
  };

  res.sseSend = function(data) {
    console.log('Sending data: ' + new Date());
    res.write("data: " + JSON.stringify(data) + "\n\n" + "retry: 10000\n");
  };


  next()
};
