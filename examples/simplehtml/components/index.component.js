// Create a request variable and assign a new XMLHttpRequest object to it.
var request = new XMLHttpRequest();

// Open a new connection, using the GET request on the URL endpoint
request.open("GET", "/index/config/objects.json", true);

request.onload = function () {
    
    var data = JSON.parse(this.response);

    JSON.parse(this.response).forEach(movie => {
        console.log(movie.title);
    });
}

// Send request
request.send();
