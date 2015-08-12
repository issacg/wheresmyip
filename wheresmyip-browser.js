var wheresmyip = {
    alert: (console && console.log && typeof(console.log) == "function") ? console.log : function(s) {},
    submit: function() {
        if (!(navigator && navigator.geolocation && navigator.geolocation.getCurrentPosition && typeof(navigator.geolocation.getCurrentPosition) == "function")) {
            alert("You don't seem to be a Location-API aware browser.  Aborting!");
            return;
        }
        navigator.geolocation.getCurrentPosition(function(pos) {
            var obj = {lat: pos.coords.latitude, lon: pos.coords.longitude};
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "https://api.wheresmyip.org/ip", true);
            xhr.setRequestHeader("Content-type","application/json");
            xhr.send(JSON.stringify(obj));
        }, alert, {
            enableHighAccuracy: true,
            maximumAge: 300000,
            timeout: 60000
        });
        }
};
wheresmyip.submit();
