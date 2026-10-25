(function() {
    'use strict';

    var sheetId = '1zd9E7284QgXLppdIHDb7LYYgF8gSzHkn4IkBRbgfbgk';
    var sheetName = 'Sheet1';
    var sheetUrl = 'https://docs.google.com/spreadsheets/d/' + sheetId +
        '/gviz/tq?sheet=' + encodeURIComponent(sheetName);
    var categoryColors = ['is-gold', 'is-coral', 'is-sky', 'is-navy'];
    var root = document.getElementById('stcvr');

    if (!root) {
        return;
    }

    var bands = root.querySelector('.stcvr-bands');
    var status = root.querySelector('[data-stcvr-status]');
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

    function readTable(data) {
        var table = data && data.table;
        if (!table || !Array.isArray(table.rows) || !Array.isArray(table.cols)) {
            throw new Error('The spreadsheet response did not contain a table.');
        }

        var headers = table.cols.map(function(column) {
            return column.label || column.id || '';
        });
        var rows = table.rows;
        var firstRow = rows.length ? (rows[0].c || []).map(cellValue) : [];
        var expectedHeaders = ['category', 'role'];
        var firstRowIsHeader = expectedHeaders.every(function(header) {
            return firstRow.some(function(value) {
                return columnName(value) === header;
            });
        });

        if (firstRowIsHeader) {
            headers = firstRow;
            rows = rows.slice(1);
        }

        var indexes = {};
        headers.forEach(function(header, index) {
            indexes[columnName(header)] = index;
        });

        if (indexes.category == null || indexes.role == null) {
            throw new Error('The spreadsheet needs Category and Role columns.');
        }

        return rows.map(function(row) {
            var cells = row.c || [];
            var get = function(name) {
                var index = indexes[name];
                return index == null ? '' : cellValue(cells[index]);
            };
            return {
                category: get('category'),
                role: get('role'),
                subHeader: get('sub-header'),
                description: get('description'),
                responsibilities: get('responsibilities'),
                experience: get('experience'),
                commitment: get('commitment')
            };
        }).filter(function(role) {
            return role.category && role.role;
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

    function slug(text) {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'role';
    }

    function createEmailButton(roleName) {
        var button = element('a', 'stcvr-btn');
        button.setAttribute('data-role', roleName);
        button.setAttribute('href', '#stcvr-reply');
        var icon = element('svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('stroke-width', '2.2');
        icon.setAttribute('stroke-linecap', 'round');
        icon.setAttribute('stroke-linejoin', 'round');
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('focusable', 'false');
        var rect = element('rect');
        rect.setAttribute('x', '3');
        rect.setAttribute('y', '5');
        rect.setAttribute('width', '18');
        rect.setAttribute('height', '14');
        rect.setAttribute('rx', '1');
        var path = element('path');
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
        appendText(heading, 'span', 'stcvr-role-sub', role.subHeader);
        card.appendChild(heading);
        appendText(card, 'p', 'stcvr-hook', role.description);

        if (role.commitment) {
            var time = element('p', 'stcvr-time');
            var icon = element('svg');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('stroke-width', '2.4');
            icon.setAttribute('stroke-linecap', 'round');
            icon.setAttribute('stroke-linejoin', 'round');
            icon.setAttribute('aria-hidden', 'true');
            icon.setAttribute('focusable', 'false');
            var circle = element('circle');
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', '12');
            circle.setAttribute('r', '9');
            var clockHand = element('path');
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

        var toggle = element('button', 'stcvr-toggle');
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', id + '-details');
        appendText(toggle, 'span', 'stcvr-toggle-text', 'See details');
        appendText(toggle, 'span', 'stcvr-sr', ' for ' + role.role);
        var chevron = element('svg');
        chevron.setAttribute('viewBox', '0 0 24 24');
        chevron.setAttribute('stroke-width', '2.6');
        chevron.setAttribute('stroke-linecap', 'round');
        chevron.setAttribute('stroke-linejoin', 'round');
        chevron.setAttribute('aria-hidden', 'true');
        chevron.setAttribute('focusable', 'false');
        var chevronPath = element('path');
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

    function buildRoleGroups(roles) {
        var categories = [];
        var grouped = Object.create(null);
        roles.forEach(function(role) {
            if (!grouped[role.category]) {
                grouped[role.category] = [];
                categories.push(role.category);
            }
            grouped[role.category].push(role);
        });

        var usedIds = {};
        var fragment = document.createDocumentFragment();
        categories.forEach(function(category, categoryIndex) {
            var section = element('div', 'stcvr-catsec ' + categoryColors[categoryIndex % categoryColors.length]);
            var heading = element('div', 'stcvr-cat');
            var title = element('h3', 'stcvr-cat-title');
            title.appendChild(element('span', 'stcvr-cat-dot'));
            title.firstChild.setAttribute('aria-hidden', 'true');
            title.appendChild(document.createTextNode(category));
            heading.appendChild(title);
            section.appendChild(heading);

            var grid = element('div', 'stcvr-grid');
            grouped[category].forEach(function(role) {
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
        bands.replaceChildren(fragment);
        return categories.length;
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
        var cards = Array.prototype.slice.call(root.querySelectorAll('.stcvr-card'));
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
            return cards.some(function(card) {
                return !card.classList.contains('is-open');
            });
        }

        function syncExpand() {
            if (expandButton) {
                expandButton.textContent = anyClosed() ? 'Open all roles' : 'Close all roles';
            }
        }

        cards.forEach(function(card) {
            var toggle = card.querySelector('.stcvr-toggle');
            toggle.addEventListener('click', function() {
                setOpen(card, !card.classList.contains('is-open'));
                syncExpand();
            });
        });

        if (expandButton) {
            expandButton.addEventListener('click', function() {
                var open = anyClosed();
                cards.forEach(function(card) {
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
                var categoryCount = buildRoleGroups(roles);
                var countText = root.querySelector('[data-stcvr-role-count]');
                if (countText) {
                    countText.textContent = 'Right now ' + roles.length + ' roles are open, grouped into ' +
                        categoryCount + ' kinds of work. All of them are unpaid, and there may be room for more than one person in each. If one sounds like you, email us. We’ll follow up to talk it through and make sure it’s a good fit on both sides.';
                }
                if (status) {
                    status.hidden = true;
                }
                setupEmailLinks();
                setupInteractions();
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
