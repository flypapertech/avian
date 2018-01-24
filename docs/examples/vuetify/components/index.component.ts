// Inbox Vue Component

const Index = new Vue(
    {
        el: "#index",
        data: {
            objects: {}
        },
        created () {
            fetch("/index/storage/objects.json")
            .then(response =>response.json())
            .then(json => {
                this.objects = json.objects
            })

        }
    })
