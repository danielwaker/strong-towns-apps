(function() {
    'use strict';

    var sheetId = '1zd9E7284QgXLppdIHDb7LYYgF8gSzHkn4IkBRbgfbgk';
    var sheetName = 'LiveSheetOnTheWebsite';
    var sheetUrl = 'https://docs.google.com/spreadsheets/d/' + sheetId +
        '/gviz/tq?sheet=' + encodeURIComponent(sheetName) + '&headers=1';
    var categoryColors = ['is-gold', 'is-coral', 'is-sky', 'is-navy'];
    var root = document.getElementById('stcvr');

    if (!root) {
        return;
    }

    var bands = root.querySelector('.stcvr-bands');
    var upcomingSection = root.querySelector('[data-stcvr-upcoming]');
    var upcomingGrid = root.querySelector('[data-stcvr-upcoming-grid]');
    var status = root.querySelector('[data-stcvr-status]');
    var locationResults = Object.create(null);
    var locationQueue = Promise.resolve();
    var lastLocationRequest = 0;
    var locationCachePrefix = 'stcvr-osm-location-v1:';
    var email = (root.getAttribute('data-email') || '').replace(/\s+/g, '');

    function cellValue(cell) {
        if (!cell) {
            return '';
        }
        var value = cell.f != null ? cell.f : cell.v;
        return value == null ? '' : String(value).trim();
    }

    function columnName(value) {
        return String(value || '').trim().toLowerCase();
    }

    function canonicalHeader(value) {
        var name = columnName(value).replace(/\s+/g, ' ');
        var aliases = {
            'short description': 'role',
            'experience desired': 'experience',
            address: 'location'
        };
        return aliases[name] || name;
    }

    function parseSheetDate(value) {
        if (!value) {
            return null;
        }
        if (value instanceof Date && !isNaN(value.getTime())) {
            return value;
        }
        var text = String(value).trim();
        var gvizDate = text.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/);
        if (gvizDate) {
            return new Date(
                Number(gvizDate[1]),
                Number(gvizDate[2]),
                Number(gvizDate[3]),
                Number(gvizDate[4] || 0),
                Number(gvizDate[5] || 0),
                Number(gvizDate[6] || 0)
            );
        }

        var namedDate = text.match(/^(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i);
        if (namedDate) {
            var months = ['january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'];
            var month = months.indexOf(namedDate[1].toLowerCase());
            if (month >= 0) {
                var hour = Number(namedDate[4] || 0) % 12;
                if (namedDate[6] && namedDate[6].toUpperCase() === 'PM') {
                    hour += 12;
                }
                return new Date(
                    Number(namedDate[3]),
                    month,
                    Number(namedDate[2]),
                    hour,
                    Number(namedDate[5] || 0)
                );
            }
        }

        var numericDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i);
        if (numericDate) {
            var numericHour = Number(numericDate[4] || 0) % 12;
            if (numericDate[6] && numericDate[6].toUpperCase() === 'PM') {
                numericHour += 12;
            }
            return new Date(
                Number(numericDate[3]),
                Number(numericDate[1]) - 1,
                Number(numericDate[2]),
                numericHour,
                Number(numericDate[5] || 0)
            );
        }
        return null;
    }

    function formatSheetDate(date) {
        var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        var months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        var hour = date.getHours();
        var period = hour >= 12 ? 'PM' : 'AM';
        var hour12 = hour % 12 || 12;
        return days[date.getDay()] + ', ' + months[date.getMonth()] + ' ' + date.getDate() +
            ', ' + date.getFullYear() + ' ' +
            (hour12 < 10 ? '0' : '') + hour12 + ':' +
            (date.getMinutes() < 10 ? '0' : '') + date.getMinutes() + ' ' + period;
    }

    function readTable(data) {
        var table = data && data.table;
        if (!table || !Array.isArray(table.rows) || !Array.isArray(table.cols)) {
            throw new Error('The spreadsheet response did not contain a table.');
        }

        var headers = table.cols.map(function(column) {
            var label = column.label || column.id || '';
            return canonicalHeader(label);
        });
        var rows = table.rows;
        var firstRow = rows.length ? (rows[0].c || []).map(cellValue) : [];
        var firstRowHeaders = firstRow.map(canonicalHeader);
        var firstRowIsHeader = firstRowHeaders.indexOf('category') >= 0 &&
            (firstRowHeaders.indexOf('role') >= 0 || firstRowHeaders.indexOf('sub-header') >= 0);

        if (firstRowIsHeader) {
            headers = firstRowHeaders;
            rows = rows.slice(1);
        }

        var indexes = {};
        headers.forEach(function(header, index) {
            indexes[canonicalHeader(header)] = index;
        });

        if (indexes.role == null) {
            throw new Error('The spreadsheet needs a Role or Short Description column.');
        }

        var hasVerifiedColumn = indexes.verified != null;
        return rows.map(function(row) {
            var cells = row.c || [];
            var get = function(name) {
                var index = indexes[name];
                return index == null ? '' : cellValue(cells[index]);
            };
            var dateIndex = indexes.date;
            var dateCell = dateIndex == null ? null : cells[dateIndex];
            var rawDate = dateCell && dateCell.v != null ? dateCell.v : '';
            var dateDisplay = cellValue(dateCell) || (rawDate ? String(rawDate).trim() : '');
            var parsedDate = parseSheetDate(rawDate) || parseSheetDate(dateDisplay);
            return {
                category: get('category'),
                priority: get('priority'),
                region: get('region'),
                organization: get('organization'),
                role: get('role'),
                subHeader: get('sub-header'),
                description: get('description'),
                responsibilities: get('responsibilities'),
                experience: get('experience'),
                commitment: get('commitment'),
                date: dateDisplay,
                parsedDate: parsedDate,
                location: get('location'),
                verified: get('verified')
            };
        }).filter(function(role) {
            return role.role && (!hasVerifiedColumn || role.verified === '\u2705');
        });
    }

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text) {
            node.textContent = text;
        }
        return node;
    }

    function appendText(parent, tag, className, text) {
        if (!text) {
            return null;
        }
        var node = element(tag, className, text);
        parent.appendChild(node);
        return node;
    }

    function svgElement(tag) {
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
    }

    function slug(text) {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'role';
    }

    function createEmailButton(roleName) {
        var button = element('a', 'stcvr-btn');
        button.setAttribute('data-role', roleName);
        button.setAttribute('href', '#stcvr-reply');
        var icon = svgElement('svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('stroke-width', '2.2');
        icon.setAttribute('stroke-linecap', 'round');
        icon.setAttribute('stroke-linejoin', 'round');
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('focusable', 'false');
        var rect = svgElement('rect');
        rect.setAttribute('x', '3');
        rect.setAttribute('y', '5');
        rect.setAttribute('width', '18');
        rect.setAttribute('height', '14');
        rect.setAttribute('rx', '1');
        var path = svgElement('path');
        path.setAttribute('d', 'M3.5 6.5l8.5 6.5 8.5-6.5');
        icon.appendChild(rect);
        icon.appendChild(path);
        button.appendChild(icon);
        button.appendChild(document.createTextNode('Email us about this role'));
        return button;
    }

    function makeCard(role, id) {
        var card = element('div', 'stcvr-card');
        card.id = id;

        var heading = element('h4', 'stcvr-role', role.role);
        appendText(heading, 'span', 'stcvr-role-sub', role.organization || role.subHeader);
        card.appendChild(heading);
        appendText(card, 'p', 'stcvr-hook', role.description);

        if (role.commitment) {
            var time = element('p', 'stcvr-time');
            var icon = svgElement('svg');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('stroke-width', '2.4');
            icon.setAttribute('stroke-linecap', 'round');
            icon.setAttribute('stroke-linejoin', 'round');
            icon.setAttribute('aria-hidden', 'true');
            icon.setAttribute('focusable', 'false');
            var circle = svgElement('circle');
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', '12');
            circle.setAttribute('r', '9');
            var clockHand = svgElement('path');
            clockHand.setAttribute('d', 'M12 7v5l3 2');
            icon.appendChild(circle);
            icon.appendChild(clockHand);
            time.appendChild(icon);
            var timeText = element('span');
            appendText(timeText, 'span', 'stcvr-sr', 'Time: ');
            timeText.appendChild(document.createTextNode(role.commitment));
            time.appendChild(timeText);
            card.appendChild(time);
        }

        if (role.date) {
            var date = element('p', 'stcvr-time stcvr-role-date');
            var calendar = svgElement('svg');
            calendar.setAttribute('viewBox', '0 0 24 24');
            calendar.setAttribute('stroke-width', '2.2');
            calendar.setAttribute('stroke-linecap', 'round');
            calendar.setAttribute('stroke-linejoin', 'round');
            calendar.setAttribute('aria-hidden', 'true');
            calendar.setAttribute('focusable', 'false');
            var calendarShape = svgElement('rect');
            calendarShape.setAttribute('x', '3.5');
            calendarShape.setAttribute('y', '5');
            calendarShape.setAttribute('width', '17');
            calendarShape.setAttribute('height', '16');
            calendarShape.setAttribute('rx', '1');
            var calendarLines = svgElement('path');
            calendarLines.setAttribute('d', 'M7.5 3v4M16.5 3v4M3.5 10h17');
            calendar.appendChild(calendarShape);
            calendar.appendChild(calendarLines);
            date.appendChild(calendar);
            var dateText = element('span');
            appendText(dateText, 'span', 'stcvr-sr', 'Date: ');
            var time = element('time', '');
            if (role.parsedDate) {
                time.setAttribute('datetime', role.parsedDate.getFullYear() + '-' +
                    String(role.parsedDate.getMonth() + 1).padStart(2, '0') + '-' +
                    String(role.parsedDate.getDate()).padStart(2, '0') + 'T' +
                    String(role.parsedDate.getHours()).padStart(2, '0') + ':' +
                    String(role.parsedDate.getMinutes()).padStart(2, '0'));
                time.textContent = formatSheetDate(role.parsedDate);
            } else {
                time.textContent = role.date;
            }
            dateText.appendChild(time);
            date.appendChild(dateText);
            card.appendChild(date);
        }

        if (role.location) {
            var location = element('p', 'stcvr-time stcvr-role-location');
            var pin = svgElement('svg');
            pin.setAttribute('viewBox', '0 0 24 24');
            pin.setAttribute('stroke-width', '2.2');
            pin.setAttribute('stroke-linecap', 'round');
            pin.setAttribute('stroke-linejoin', 'round');
            pin.setAttribute('aria-hidden', 'true');
            pin.setAttribute('focusable', 'false');
            var pinShape = svgElement('path');
            pinShape.setAttribute('d', 'M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z');
            var pinDot = svgElement('circle');
            pinDot.setAttribute('cx', '12');
            pinDot.setAttribute('cy', '10');
            pinDot.setAttribute('r', '2.5');
            pin.appendChild(pinShape);
            pin.appendChild(pinDot);
            location.appendChild(pin);
            var locationText = element('span');
            appendText(locationText, 'span', 'stcvr-sr', 'Location: ');
            var placeContent = element('span', 'stcvr-place');
            placeContent.setAttribute('data-place-address', role.location);
            var addressLink = element('a', 'stcvr-place-address', role.location);
            addressLink.href = 'https://www.openstreetmap.org/search?query=' +
                encodeURIComponent(role.location);
            addressLink.target = '_blank';
            addressLink.rel = 'noopener';
            placeContent.appendChild(addressLink);
            var attribution = element('small', 'stcvr-place-attribution');
            var osmLink = element('a', '', '\u00a9 OpenStreetMap contributors');
            osmLink.href = 'https://www.openstreetmap.org/copyright';
            osmLink.target = '_blank';
            osmLink.rel = 'noopener';
            attribution.appendChild(osmLink);
            placeContent.appendChild(attribution);
            locationText.appendChild(placeContent);
            location.appendChild(locationText);
            card.appendChild(location);
        }

        var toggle = element('button', 'stcvr-toggle');
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', id + '-details');
        appendText(toggle, 'span', 'stcvr-toggle-text', 'See details');
        appendText(toggle, 'span', 'stcvr-sr', ' for ' + role.role);
        var chevron = svgElement('svg');
        chevron.setAttribute('viewBox', '0 0 24 24');
        chevron.setAttribute('stroke-width', '2.6');
        chevron.setAttribute('stroke-linecap', 'round');
        chevron.setAttribute('stroke-linejoin', 'round');
        chevron.setAttribute('aria-hidden', 'true');
        chevron.setAttribute('focusable', 'false');
        var chevronPath = svgElement('path');
        chevronPath.setAttribute('d', 'M6 9l6 6 6-6');
        chevron.appendChild(chevronPath);
        toggle.appendChild(chevron);
        card.appendChild(toggle);

        var details = element('div', 'stcvr-details');
        details.id = id + '-details';
        appendText(details, 'p', 'stcvr-label', 'What you would do');
        appendText(details, 'p', 'stcvr-text', role.responsibilities);

        var experienceItems = role.experience.split('|').map(function(item) {
            return item.trim();
        }).filter(Boolean);
        if (experienceItems.length) {
            appendText(details, 'p', 'stcvr-label', 'Experience that counts');
            var list = element('ul', 'stcvr-list');
            list.setAttribute('role', 'list');
            experienceItems.forEach(function(item) {
                list.appendChild(element('li', '', item));
            });
            details.appendChild(list);
        }

        var foot = element('div', 'stcvr-card-foot');
        foot.appendChild(createEmailButton(role.role));
        details.appendChild(foot);
        card.appendChild(details);
        return card;
    }

    function addPlaceDetails() {
        var placeElements = Array.prototype.slice.call(root.querySelectorAll('.stcvr-place'));
        if (!placeElements.length) {
            return;
        }
        placeElements.forEach(function(placeElement) {
            var address = placeElement.getAttribute('data-place-address') || '';
            lookupLocation(address).then(function(result) {
                if (placeElement.isConnected) {
                    renderPlace(placeElement, result);
                }
            }).catch(function(error) {
                showLocationLookupError(placeElement, error);
            });
        });
    }

    function lookupLocation(address) {
        if (locationResults[address]) {
            return locationResults[address];
        }
        var cachedResult = getCachedLocation(address);
        if (cachedResult) {
            locationResults[address] = Promise.resolve(cachedResult);
            return locationResults[address];
        }

        var request = locationQueue.then(function() {
            var wait = Math.max(0, 1000 - (Date.now() - lastLocationRequest));
            return new Promise(function(resolve) {
                setTimeout(resolve, wait);
            });
        }).then(function() {
            lastLocationRequest = Date.now();
            var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1' +
                '&namedetails=1&limit=5&q=' + encodeURIComponent(address);
            return fetch(url, {
                headers: {
                    Accept: 'application/json'
                }
            }).then(function(response) {
                if (!response.ok) {
                    throw new Error('OpenStreetMap search failed with status ' + response.status + '.');
                }
                return response.json();
            }).then(function(results) {
                if (!Array.isArray(results) || results.length === 0) {
                    throw new Error('OpenStreetMap did not find this address.');
                }
                var place = results.find(function(result) {
                    return result.name || (result.namedetails &&
                        (result.namedetails['name:en'] || result.namedetails.name));
                }) || results[0];
                var name = place.name || (place.namedetails &&
                    (place.namedetails['name:en'] || place.namedetails.name)) || '';
                var result = {
                    name: name,
                    address: address,
                    latitude: place.lat,
                    longitude: place.lon
                };
                cacheLocation(address, result);
                return result;
            });
        });
        locationQueue = request.then(function() {}, function() {});
        locationResults[address] = request;
        return request;
    }

    function getCachedLocation(address) {
        try {
            var cached = localStorage.getItem(locationCachePrefix + address);
            if (!cached) {
                return null;
            }
            var entry = JSON.parse(cached);
            if (entry.expiresAt <= Date.now() || !entry.result) {
                localStorage.removeItem(locationCachePrefix + address);
                return null;
            }
            return entry.result;
        } catch (error) {
            console.warn('Unable to read the saved OpenStreetMap location cache:', error);
            return null;
        }
    }

    function cacheLocation(address, result) {
        try {
            localStorage.setItem(locationCachePrefix + address, JSON.stringify({
                expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
                result: result
            }));
        } catch (error) {
            console.warn('Unable to save the OpenStreetMap location cache:', error);
        }
    }

    function showLocationLookupError(placeElement, error) {
        console.error('Unable to find this location in OpenStreetMap:', error);
        placeElement.setAttribute('title', 'OpenStreetMap could not find a place name for this address.');
        if (!placeElement.querySelector('.stcvr-place-note')) {
            placeElement.appendChild(element('small', 'stcvr-place-note', 'Place name unavailable.'));
        }
    }

    function renderPlace(placeElement, result) {
        var addressLink = element('a', 'stcvr-place-address', result.address);
        var coordinates = result.latitude && result.longitude
            ? '?mlat=' + encodeURIComponent(result.latitude) + '&mlon=' +
                encodeURIComponent(result.longitude) + '#map=18/' +
                encodeURIComponent(result.latitude) + '/' + encodeURIComponent(result.longitude)
            : 'search?query=' + encodeURIComponent(result.address);
        addressLink.href = 'https://www.openstreetmap.org/' + coordinates;
        addressLink.target = '_blank';
        addressLink.rel = 'noopener';

        placeElement.replaceChildren();
        if (result.name) {
            placeElement.appendChild(element('strong', 'stcvr-place-name', result.name));
            placeElement.appendChild(document.createTextNode(' \u2014 '));
        }
        placeElement.appendChild(addressLink);
        var attribution = element('small', 'stcvr-place-attribution');
        var osmLink = element('a', '', '\u00a9 OpenStreetMap contributors');
        osmLink.href = 'https://www.openstreetmap.org/copyright';
        osmLink.target = '_blank';
        osmLink.rel = 'noopener';
        attribution.appendChild(osmLink);
        placeElement.appendChild(attribution);
    }

    function buildRoleGroups(roles, groupBy) {
        var groupNames = [];
        var grouped = Object.create(null);
        roles.forEach(function(role) {
            var groupName = role[groupBy] || (groupBy === 'priority'
                ? 'No priority set'
                : groupBy === 'region' ? 'No region set'
                    : groupBy === 'organization' ? 'Strong Towns Chicago' : 'Other');
            if (!grouped[groupName]) {
                grouped[groupName] = [];
                groupNames.push(groupName);
            }
            grouped[groupName].push(role);
        });
        if (groupBy === 'priority') {
            var priorityOrder = ['Very High', 'High', 'Medium', 'Low'];
            groupNames.sort(function(a, b) {
                var aRank = priorityOrder.indexOf(a);
                var bRank = priorityOrder.indexOf(b);
                if (aRank < 0) {
                    aRank = priorityOrder.length;
                }
                if (bRank < 0) {
                    bRank = priorityOrder.length;
                }
                return aRank - bRank;
            });
        }

        var usedIds = {};
        var fragment = document.createDocumentFragment();
        groupNames.forEach(function(groupName, groupIndex) {
            var section = element('div', 'stcvr-catsec ' + categoryColors[groupIndex % categoryColors.length]);
            var heading = element('div', 'stcvr-cat');
            var title = element('h3', 'stcvr-cat-title');
            title.appendChild(element('span', 'stcvr-cat-dot'));
            title.firstChild.setAttribute('aria-hidden', 'true');
            title.appendChild(document.createTextNode(groupName));
            heading.appendChild(title);
            section.appendChild(heading);

            var grid = element('div', 'stcvr-grid');
            grouped[groupName].forEach(function(role) {
                var baseId = 'stcvr-' + slug(role.role);
                var id = baseId;
                var suffix = 2;
                while (usedIds[id]) {
                    id = baseId + '-' + suffix++;
                }
                usedIds[id] = true;
                grid.appendChild(makeCard(role, id));
            });
            section.appendChild(grid);
            fragment.appendChild(section);
        });
        if (groupNames.length === 0) {
            fragment.appendChild(element('p', 'stcvr-hint stcvr-loading', 'No other roles listed right now.'));
        }
        bands.replaceChildren(fragment);
        return groupNames.length;
    }

    function buildUpcomingRoles(roles) {
        var datedRoles = roles.filter(function(role) {
            return role.date;
        }).sort(function(a, b) {
            if (!a.parsedDate) {
                return b.parsedDate ? 1 : 0;
            }
            if (!b.parsedDate) {
                return -1;
            }
            return a.parsedDate.getTime() - b.parsedDate.getTime();
        });

        if (!upcomingSection || !upcomingGrid) {
            return datedRoles.length;
        }
        upcomingSection.hidden = datedRoles.length === 0;
        var usedIds = Object.create(null);
        var fragment = document.createDocumentFragment();
        datedRoles.forEach(function(role) {
            var baseId = 'stcvr-upcoming-' + slug(role.role);
            var id = baseId;
            var suffix = 2;
            while (usedIds[id] || document.getElementById(id)) {
                id = baseId + '-' + suffix++;
            }
            usedIds[id] = true;
            fragment.appendChild(makeCard(role, id));
        });
        upcomingGrid.replaceChildren(fragment);
        return datedRoles.length;
    }

    function setStatus(message, isError) {
        if (!status) {
            return;
        }
        status.textContent = message;
        status.hidden = false;
        status.setAttribute('role', isError ? 'alert' : 'status');
    }

    function setupInteractions() {
        var expandButton = root.querySelector('[data-stcvr-expand]');

        function setOpen(card, open) {
            card.classList.toggle('is-open', open);
            var toggle = card.querySelector('.stcvr-toggle');
            if (!toggle) {
                return;
            }
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            var text = toggle.querySelector('.stcvr-toggle-text');
            if (text) {
                text.textContent = open ? 'Hide details' : 'See details';
            }
        }

        function anyClosed() {
            return Array.prototype.some.call(root.querySelectorAll('.stcvr-card'), function(card) {
                return !card.classList.contains('is-open');
            });
        }

        function syncExpand() {
            if (expandButton) {
                expandButton.textContent = anyClosed() ? 'Open all roles' : 'Close all roles';
            }
        }

        root.addEventListener('click', function(event) {
            var toggle = event.target.closest('.stcvr-toggle');
            if (toggle && root.contains(toggle)) {
                var card = toggle.closest('.stcvr-card');
                if (card) {
                    setOpen(card, !card.classList.contains('is-open'));
                    syncExpand();
                }
            }
        });

        if (expandButton) {
            expandButton.addEventListener('click', function() {
                var open = anyClosed();
                Array.prototype.forEach.call(root.querySelectorAll('.stcvr-card'), function(card) {
                    setOpen(card, open);
                });
                syncExpand();
            });
        }

        function openFromHash() {
            var target = document.getElementById((window.location.hash || '').replace(/^#/, ''));
            if (target && root.contains(target) && target.classList.contains('stcvr-card')) {
                setOpen(target, true);
            }
        }

        openFromHash();
        syncExpand();
        window.addEventListener('hashchange', function() {
            openFromHash();
            syncExpand();
        });
        return syncExpand;
    }

    function setupEmailLinks() {
        var needsSetup = !email || /change-me|example\.com/i.test(email);
        Array.prototype.forEach.call(root.querySelectorAll('a[data-role]'), function(button) {
            var role = button.getAttribute('data-role') || '';
            var lines = [
                'Hi Strong Towns Chicago,',
                '',
                "I'm interested in the " + role + ' role.',
                '',
                'Something about Chicago I would like to see change:',
                '',
                'Relevant experience:',
                '',
                'Time I can give:'
            ];
            button.setAttribute('href', 'mailto:' + email +
                '?subject=' + encodeURIComponent('Volunteer role: ' + role) +
                '&body=' + encodeURIComponent(lines.join('\r\n')));
        });

        Array.prototype.forEach.call(root.querySelectorAll('[data-stcvr-email]'), function(link) {
            link.textContent = email;
            link.setAttribute('href', 'mailto:' + email);
        });

        var copyButton = root.querySelector('[data-stcvr-copy]');
        if (copyButton && !needsSetup) {
            copyButton.hidden = false;
            var originalLabel = copyButton.textContent;
            var timer;
            function flash(text) {
                copyButton.textContent = text;
                clearTimeout(timer);
                timer = setTimeout(function() {
                    copyButton.textContent = originalLabel;
                }, 1800);
            }
            function fallbackCopy() {
                var input = document.createElement('textarea');
                input.value = email;
                input.setAttribute('readonly', '');
                input.style.position = 'absolute';
                input.style.left = '-9999px';
                document.body.appendChild(input);
                input.select();
                var copied = document.execCommand('copy');
                document.body.removeChild(input);
                flash(copied ? 'Copied' : 'Copy failed');
            }
            copyButton.addEventListener('click', function() {
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(email).then(function() {
                        flash('Copied');
                    }, fallbackCopy);
                } else {
                    fallbackCopy();
                }
            });
        }

        if (needsSetup) {
            var note = element('p', 'stcvr-setup',
                'Setup needed: replace CHANGE-ME@example.com at the top of this code block with your volunteer inbox address. The email buttons will not work until you do.');
            note.setAttribute('role', 'alert');
            root.insertBefore(note, root.firstChild);
        }
    }

    function initialize() {
        if (!bands) {
            setStatus('The volunteer roles could not be displayed because the page is missing its roles container.', true);
            return;
        }
        setStatus('Loading volunteer roles…', false);
        fetch(sheetUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Spreadsheet request failed with status ' + response.status + '.');
                }
                return response.text();
            })
            .then(function(responseText) {
                var start = responseText.indexOf('(');
                var end = responseText.lastIndexOf(')');
                if (start < 0 || end <= start) {
                    throw new Error('The spreadsheet response was not in the expected format.');
                }
                return JSON.parse(responseText.slice(start + 1, end));
            })
            .then(function(data) {
                var roles = readTable(data);
                if (!roles.length) {
                    var emptyCount = root.querySelector('[data-stcvr-role-count]');
                    if (emptyCount) {
                        emptyCount.textContent = 'There are no volunteer roles listed right now.';
                    }
                    setStatus('There are no volunteer roles listed right now.', false);
                    return;
                }
                var upcomingCount = buildUpcomingRoles(roles);
                var generalRoles = roles.filter(function(role) {
                    return !role.date;
                });
                var groupBy = root.querySelector('[data-stcvr-group-by]');
                var grouping = groupBy ? groupBy.value : 'category';
                var groupCount = buildRoleGroups(generalRoles, grouping);
                var countText = root.querySelector('[data-stcvr-role-count]');
                var updateSummary = function(grouping, count) {
                    if (!countText) {
                        return;
                    }
                    var summary = 'Right now ' + roles.length + ' roles are open';
                    if (upcomingCount) {
                        summary += ', including ' + upcomingCount + ' upcoming';
                    }
                    if (count) {
                        var groupLabel = grouping === 'priority' ? 'priority levels'
                            : grouping === 'region' ? 'regions'
                                : grouping === 'organization' ? 'organizations' : 'kinds of work';
                        summary += upcomingCount
                            ? '. The remaining ' + generalRoles.length + ' are grouped into ' + count + ' ' + groupLabel
                            : '. Grouped into ' + count + ' ' + groupLabel;
                    }
                    countText.textContent = summary +
                        '. All of them are unpaid, and there may be room for more than one person in each. If one sounds like you, email us. We\'ll follow up to talk it through and make sure it\'s a good fit on both sides.';
                }
                updateSummary(grouping, groupCount);
                if (status) {
                    status.hidden = true;
                }
                setupEmailLinks();
                addPlaceDetails();
                var syncExpand = setupInteractions();
                if (groupBy) {
                    groupBy.addEventListener('change', function() {
                        var groupCount = buildRoleGroups(generalRoles, groupBy.value);
                        addPlaceDetails();
                        updateSummary(groupBy.value, groupCount);
                        syncExpand();
                    });
                }
            })
            .catch(function(error) {
                console.error('Unable to load volunteer roles:', error);
                var countText = root.querySelector('[data-stcvr-role-count]');
                if (countText) {
                    countText.textContent = 'We could not load the current volunteer roles right now.';
                }
                setStatus('Volunteer roles could not be loaded right now. Please try again later or email ' +
                    (email || 'our volunteer inbox') + '.', true);
            });
    }

    initialize();
})();
