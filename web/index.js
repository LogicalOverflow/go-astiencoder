var astiencoder = {
    init () {
        // Handle keyboard
        document.addEventListener('keyup', this.onKeyUp.bind(this))

        // Open websocket
        this.openWebSocket({
            onopen: this.onopen.bind(this),
            onmessage: this.onmessage.bind(this)
        })
    },
    reset () {
        // Remove tags
        for (var name in this.tags) {
            delete(this.tags[name])
        }

        // Remove nodes
        for (var name in this.nodes) {
            delete(this.nodes[name])
        }
    },
    onopen () {
        // Fetch welcome
        this.sendHttp({
            method: 'GET',
            url: '/welcome',
            onsuccess: function(data) {
                // Reset
                this.reset()
                
                // Update recording
                this.recording.disabled = typeof data.workflow === 'undefined'
                this.recording.started = data.recording

                // Loop through nodes
                if (data.workflow) {
                    data.workflow.nodes.forEach(function(item) {
                        // Apply changes
                        this.apply(item.name, item)
                    }.bind(this))
                }
            }.bind(this)
        })
    },
    onmessage (name, payload) {
        switch (name) {
            case 'astiencoder.node.continued':
                this.apply(payload, {status: 'running'})
                break
            case 'astiencoder.node.paused':
                this.apply(payload, {status: 'paused'})
                break
            case 'astiencoder.node.stats':
                this.apply(payload.name, {stats: payload.stats})
                break
            case 'astiencoder.node.started':
                this.apply(payload.name, payload)
                break
            case 'astiencoder.node.stopped':
                this.apply(payload, {status: 'stopped'})
                break
        }
    },
    onKeyUp (event) {
        switch (event.code) {
            case 'ArrowRight':
                if (this.playback.loaded && !this.playback.done) this.onPlaybackNextClick()
                break
        }
    },

    /* recording */
    recording: new Proxy({}, {
        set: function(obj, prop, value) {
            // Nothing changed
            if (typeof obj[prop] !== 'undefined' && obj[prop] === value) return

            // Switch on prop
            switch (prop) {
                case 'disabled':
                    if (value) document.querySelector('footer').classList.add('recording-disabled')
                    else document.querySelector('footer').classList.remove('recording-disabled')
                    break
                case 'started':
                    if (value) document.querySelector('footer').classList.add('recording-started')
                    else document.querySelector('footer').classList.remove('recording-started')
                    break
            }

            // Store value
            obj[prop] = value
            return true
        }
    }),
    onRecordingStartClick () {
        // Start
        this.sendHttp({
            method: 'GET',
            url: '/recording/start',
            onsuccess: function() {
                // Update recording
                this.recording.started = true
            }.bind(this)
        })
    },
    onRecordingStopClick () {
        // Start
        this.sendHttp({
            method: 'GET',
            url: '/recording/stop',
            onsuccess: function() {
                // Update recording
                this.recording.started = false

                // Redirect to export
                var link = document.createElement('a')
                link.href = '/recording/export'
                link.target = '_blank'
                link.click()
            }.bind(this)
        })
    },

    /* playback */
    playback: new Proxy({}, {
        set: function(obj, prop, value) {
            // Nothing changed
            if (typeof obj[prop] !== 'undefined' && obj[prop] === value) return

            // Switch on prop
            switch (prop) {
                case 'done':
                    if (value) document.querySelector('footer').classList.add('playback-done')
                    else document.querySelector('footer').classList.remove('playback-done')
                    break
                case 'loaded':
                    if (value) document.querySelector('footer').classList.add('playback-loaded')
                    else document.querySelector('footer').classList.remove('playback-loaded')
                    break
            }

            // Store value
            obj[prop] = value
            return true
        }
    }),
    onPlaybackLoadClick () {
        document.querySelector('#playback-load input').click()
    },
    onPlaybackLoadChange (event) {
        // No file
        if (event.target.files.length === 0) return

        // Create form data
        const d = new FormData()
        d.append('file', event.target.files[0])

        // Load
        this.sendHttp({
            method: 'POST',
            url: '/playback/load',
            payload: d,
            onsuccess: function(data) {
                // Reset
                this.reset()

                // Update playback
                this.playback.done = false
                this.playback.loaded = true

                // Loop through nodes
                data.nodes.forEach(function(item) {
                    // Apply changes
                    this.apply(item.name, item)
                }.bind(this))
            }.bind(this)
        })
    },
    onPlaybackUnloadClick () {
        // Unload
        this.sendHttp({
            method: 'GET',
            url: '/playback/unload',
            onsuccess: function(data) {
                // Reset
                this.reset()

                // Update playback
                this.playback.loaded = false

                // Loop through nodes
                if (data) {
                    data.nodes.forEach(function(item) {
                        // Apply changes
                        this.apply(item.name, item)
                    }.bind(this))
                }
            }.bind(this)
        })
    },
    onPlaybackNextClick () {
        // Next
        this.sendHttp({
            method: 'GET',
            url: '/playback/next',
            onsuccess: function(data) {
                // Update playback
                this.playback.done = data.done

                // Loop through items
                data.items.forEach(function(item) {
                    this.onmessage(item.name, item.payload)
                }.bind(this))
            }.bind(this)
        })
    },

    /* tags */
    tags: new Proxy({}, {
        deleteProperty: function(obj, prop) {
            // Get value
            const value = obj[prop]
            if (!value) return

            // Delete wrapper
            document.getElementById('tags').removeChild(value.dom.w)

            // Delete prop
            delete(obj[prop])
        },
        set: function(obj, prop, value) {
            // Tag already exists
            if (typeof obj[prop] !== 'undefined') return

            // Create tag
            var t = {
                _key: prop,
                dom: {},
            }

            // Create wrapper
            t.dom.w = document.createElement('div')

            // Append wrapper in alphabetical order
            var p = null
            for (var name in astiencoder.tags) {
                const i = astiencoder.tags[name]
                if (t._key < i._key && (!p || p._key > i._key)) p = i
            }
            if (p) document.getElementById('tags').insertBefore(t.dom.w, p.dom.w)
            else document.getElementById('tags').appendChild(t.dom.w)

            // Add show
            const _s = document.createElement('i')
            _s.className = 'fa fa-eye'
            _s.onclick = function() {
                astiencoder.tags[prop].hide = false
                astiencoder.tags[prop].show = !astiencoder.tags[prop].show
            }
            t.dom.w.appendChild(_s)

            // Add label
            const _l = document.createElement('span')
            _l.innerText = prop
            t.dom.w.appendChild(_l)

            // Add hide
            const _h = document.createElement('i')
            _h.className = 'fa fa-eye-slash'
            _h.onclick = function() {
                astiencoder.tags[prop].show = false
                astiencoder.tags[prop].hide = !astiencoder.tags[prop].hide
            }
            t.dom.w.appendChild(_h)

            // Store value
            obj[prop] = new Proxy(t, {
                set: function(obj, prop, value) {
                    // Nothing changed
                    if (typeof obj[prop] !== 'undefined' && obj[prop] === value) return

                    // Store value
                    obj[prop] = value

                    // Switch on prop
                    switch (prop) {
                        case 'hide':
                            if (value) _h.classList.add('active')
                            else _h.classList.remove('active')
                            break
                        case 'show':
                            if (value) _s.classList.add('active')
                            else _s.classList.remove('active')
                            break
                    }

                    // Refresh tags
                    astiencoder.refreshTags()
                    return true
                }
            })
            return true
        }
    }),
    refreshTags () {
        for (var name in this.nodes) {
            this.refreshTagsForNode(name)
        }
    },
    refreshTagsForNode (name) {
        // Index tags
        var hides = {}
        var shows = {}
        for (var tag in this.tags) {
            if (this.tags[tag].hide) hides[tag] = true
            if (this.tags[tag].show) shows[tag] = true
        }

        // Check node
        var hide = false
        var show = false
        for (var tag in this.nodes[name].tags) {
            if (hides[tag]) hide = true
            else if (shows[tag]) show = true
        }

        // Update node
        if (hide) this.nodes[name].notInTags = true
        else if (show) this.nodes[name].notInTags = false
        else this.nodes[name].notInTags = Object.keys(shows).length > 0
    },
    onResetAllTags () {
        for (var name in astiencoder.tags) {
            astiencoder.tags[name].hide = false
            astiencoder.tags[name].show = false
        }
    },

    /* nodes */
    nodes: new Proxy({}, {
        deleteProperty: function(obj, prop) {
            // Get value
            const value = obj[prop]
            if (!value) return

            // Delete wrapper
            document.getElementById('nodes').removeChild(value.dom.w)

            // Delete prop
            delete(obj[prop])
        },
        set: function(obj, prop, value) {
            // Node already exists
            if (typeof obj[prop] !== 'undefined') return

            // Create node
            var n = {
                _key: value.label,
                dom: {},
            }

            // We need to store locally the node name since it's used by refreshTagsForNode
            const nodeName = prop

            // Create wrapper
            n.dom.w = document.createElement('div')

            // Append wrapper in label alphabetical order
            var p = null
            for (var name in astiencoder.nodes) {
                const i = astiencoder.nodes[name]
                if (n._key < i._key && (!p || p._key > i._key)) p = i
            }
            if (p) document.getElementById('nodes').insertBefore(n.dom.w, p.dom.w)
            else document.getElementById('nodes').appendChild(n.dom.w)

            // Add children
            n.children = new Proxy({}, {
                deleteProperty: function(obj, prop) {
                    // Delete prop
                    delete(obj[prop])

                    // Refresh not active
                    astiencoder.refreshNotActive(n)
                },
                set: function(obj, prop, value) {
                    // Nothing changed
                    if (typeof obj[prop] !== 'undefined' && obj[prop] === value) return

                    // Store value
                    obj[prop] = value

                    // Refresh not active
                    astiencoder.refreshNotActive(n)
                    return true
                }
            })

            // Add label
            const _l = document.createElement('div')
            _l.className = 'label'
            n.dom.w.appendChild(_l)

            // Add name
            const _n = document.createElement('div')
            _n.className = 'name'
            n.dom.w.appendChild(_n)

            // Add parents
            n.parents = new Proxy({}, {
                deleteProperty: function(obj, prop) {
                    // Delete prop
                    delete(obj[prop])

                    // Refresh not active
                    astiencoder.refreshNotActive(n)
                },
                set: function(obj, prop, value) {
                    // Nothing changed
                    if (typeof obj[prop] !== 'undefined' && obj[prop] === value) return

                    // Store value
                    obj[prop] = value

                    // Refresh not active
                    astiencoder.refreshNotActive(n)
                    return true
                }
            })

            // Add stats
            const _ss = document.createElement('table')
            _ss.className = 'stats'
            n.dom.w.appendChild(_ss)
            n.stats = new Proxy({}, {
                set: function(obj, prop, value) {
                    // Stat already exists
                    if (typeof obj[prop] !== 'undefined') return

                    // Create stats
                    var s = {
                        _key: value.label,
                        dom: {}
                    }

                    // Create row
                    s.dom.r = document.createElement('tr')

                    // Append row in label alphabetical order
                    var p = null
                    for (var name in obj) {
                        const i = obj[name]
                        if (s._key < i._key && (!p || p._key > i._key)) p = i
                    }
                    if (p) _ss.insertBefore(s.dom.r, p.dom.r)
                    else _ss.appendChild(s.dom.r)

                    // Add label
                    const _c1 = document.createElement('td')
                    s.dom.r.appendChild(_c1)

                    // Add value
                    const _c2 = document.createElement('td')
                    s.dom.r.appendChild(_c2)
                    const _v = document.createElement('span')
                    _c2.appendChild(_v)

                    // Add unit
                    const _u = document.createElement('span')
                    _c2.appendChild(_u)

                    // Store stat
                    obj[prop] = new Proxy(s, {
                        set: function(obj, prop, value) {
                            // Nothing changed
                            if (typeof obj[prop] !== 'undefined' && obj[prop] === value) return

                            // Switch on prop
                            switch (prop) {
                                case 'label':
                                    _c1.innerText = value + ':'
                                    break
                                case 'unit':
                                    _u.innerText = value
                                    break
                                case 'value':
                                    _v.innerText = value
                                    break
                            }
        
                            // Store value
                            obj[prop] = value
                            return true
                        }
                    })
                    return true
                }
            })

            // Add tags
            n.tags = new Proxy({}, {
                set: function(obj, prop, value) {
                    // Nothing changed
                    if (typeof obj[prop] !== 'undefined' && obj[prop] === value) return

                    // Add tag
                    // If tag exists, it will do nothing
                    astiencoder.tags[prop] = true

                    // Store value
                    obj[prop] = value

                    // Refresh tags
                    astiencoder.refreshTagsForNode(nodeName)
                    return true
                }
            })

            // Store node
            obj[prop] = new Proxy(n, {
                set: function(obj, prop, value) {
                    // Nothing changed
                    if (typeof obj[prop] !== 'undefined' && obj[prop] === value) return

                    // Switch on prop
                    var refreshNotActive = false
                    switch (prop) {
                        case 'label':
                            _l.innerText = value
                            break
                        case 'name':
                            _n.innerText = value
                            break
                        case 'notInSearch':
                            if (value) n.dom.w.classList.add('not-in-search')
                            else n.dom.w.classList.remove('not-in-search')
                            break
                        case 'notInTags':
                            if (value) n.dom.w.classList.add('not-in-tags')
                            else n.dom.w.classList.remove('not-in-tags')
                            break
                        case 'status':
                            if (obj[prop] !== value) {
                                // Update class
                                n.dom.w.classList.remove(obj[prop])
                                n.dom.w.classList.add(value)

                                // Update tags
                                delete(n.tags[obj[prop]])
                                n.tags[value] = true

                                // Refresh not active
                                refreshNotActive = true
                            }
                            break
                    }

                    // Store value
                    obj[prop] = value

                    // Refresh not active
                    // It needs the new value to be set
                    if (refreshNotActive) astiencoder.refreshNotActive(n)
                    return true
                }
            })
            return true
        }
    }),
    refreshNotActive (n) {
        if (Object.keys(n.children).length === 0
            && Object.keys(n.parents).length === 0
            && n.status === 'stopped') n.dom.w.classList.add('not-active')
        else n.dom.w.classList.remove('not-active')
    },
    apply (name, payload) {
        // Add node
        // If node already exists, it will do nothing
        this.nodes[name] = payload

        // Children
        if (payload.children) {
            payload.children.forEach(function(item) {
                this.nodes[name].children[item] = true
            }.bind(this))
        }

        // Description
        if (payload.description) this.nodes[name].description = payload.description

        // Label
        if (payload.label) this.nodes[name].label = payload.label

        // Name
        if (payload.name) this.nodes[name].name = payload.name

        // Parents
        if (payload.parents) {
            payload.parents.forEach(function(item) {
                this.nodes[name].parents[item] = true
            }.bind(this))
        }

        // Stats
        if (payload.stats) {
            // Loop through stats
            payload.stats.forEach(function(item) {
                // Add stat
                // If stat already exists, it will do nothing
                this.nodes[name].stats[item.label] = item

                // Description
                if (item.description) this.nodes[name].stats[item.label].description = item.description

                // Label
                if (item.label) this.nodes[name].stats[item.label].label = item.label

                // Unit
                if (item.unit) this.nodes[name].stats[item.label].unit = item.unit

                // Value
                if (typeof item.value !== 'undefined') {
                    var v = item.value.toFixed(2)
                    if (v < 10 && v >= 0) v = '0' + v
                    else if (v > -10 && v < 0) v = '-0' + (-v)
                    this.nodes[name].stats[item.label].value = v
                }
            }.bind(this))
        }

        // Status
        if (payload.status) this.nodes[name].status = payload.status

        // Tags
        if (payload.tags) {
            // Loop through tags
            payload.tags.forEach(function(item) {
                this.nodes[name].tags[item] = true
            }.bind(this))
        }
    },

    /* search */
    onSearch (event) {
        // Loop through nodes
        for (var name in this.nodes) {
            this.nodes[name].notInSearch = event.target.value !== ''
                && this.nodes[name].label.toLowerCase().search(event.target.value.toLowerCase()) === -1
                && this.nodes[name].name.toLowerCase().search(event.target.value.toLowerCase()) === -1
        }
    },

    /* helpers */
    sendHttp (options) {
        const req = new XMLHttpRequest()
        req.onreadystatechange = function() {
            if (this.readyState === XMLHttpRequest.DONE) {
                var data = null
                try {
                    if (this.responseText !== '') data = JSON.parse(this.responseText)
                } catch (e) {}
                if (this.status >= 200 && this.status < 300) {
                    if (options.onsuccess) options.onsuccess(data)
                } else {
                    if (options.onerror) options.onerror(data)
                }
            }
        }
        req.open(options.method, options.url, true)
        req.send(options.payload)
    },
    openWebSocket (options) {
        // Make sure to close the websocket when page closes
        if (!this.unloadHandled) {
            if (this.ws) {
                this.ws.close()
                this.ws = null
            }
            this.unloadHandled = true
        }

        // Send health request
        this.sendHttp({
            url: '/ok',
            method: 'GET',
            onerror: function() {
                // Make sure to reconnect when server is down
                setTimeout(function() {
                    this.openWebSocket(options)
                }.bind(this), 1000)
            }.bind(this),
            onsuccess: function() {
                // Create websocket
                this.ws = new WebSocket((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/websocket')
    
                // Handle open
                var pingInterval = null
                this.ws.onopen = function() {
                    // Make sure to ping
                    pingInterval = setInterval(function() {
                        this.sendWebSocket('ping')
                    }.bind(this), 50*1e3)
    
                    // Open callback
                    options.onopen()
                }.bind(this)
    
                // Handle close
                this.ws.onclose = function() {
                    // Cancel ping
                    clearInterval(pingInterval)
    
                    // Reconnect
                    setTimeout(function() {
                        this.openWebSocket(options)
                    }.bind(this), 1000)
                }.bind(this)
    
                // Handle message
                this.ws.onmessage = function(event) {
                    var data = JSON.parse(event.data)
                    options.onmessage(data.event_name, data.payload)
                }.bind(this)
            }.bind(this)
        })
    },
    sendWebSocket (name, payload) {
        if (!this.ws) return
        var d = {event_name: name}
        if (payload) d.payload = payload
        this.ws.send(JSON.stringify(d))
    }
}

astiencoder.init()
