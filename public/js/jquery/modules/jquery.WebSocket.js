(function($){

    // attach to jQuery
    $.extend({
        // export WebSocket = $.WebSocket
        WebSocket: function(options) {
			var socket,
				me;

			me = this;
			this.options = options;
			// Option keys which will be set as class properties in setOptions
			this.optionsAsProperty = ['elements', 'listeners'];
			// Websocket messages / listeners which are allowed when user is not logged in
			this.allowedListenersWhenLoggedOut = ['open', 'login'];
			// number of reconnects tried
			this.reconnectsTried = 0;

			this.setOptions = function(options) {
				for (var key in options) {
					if (this.optionsAsProperty.indexOf(key) != -1) {
						this[key] = options[key];
					}
				}
			};

			this.reconnectionCallback = function() {
				me.reconnectsTried++;
				notification = $(me.elements.notification);
				if (me.checkMaxReconnects()) {
					if (window.managedSocket.readyState == window.managedSocket.CLOSED || window.managedSocket.readyState == window.managedSocket.CONNECTING) {
						me.connect();
						// Try to reconnect every 3 seconds
						window.setTimeout(me.reconnectionCallback, 3000);
					} else {
						notification.hide(400);
					}
				} else {
					notificationText = notification.find('#poker-notification-text');
					notificationText.html('Konnte die Verbindung nicht wiederherstellen. Bitte versuch es später noch einmal.');
					notificationText.removeClass(me.elements.loaderBackgroundClass);
				}
			};

			this.checkMaxReconnects = function() {
				return (me.options.socket.maxReconnects > me.reconnectsTried);
			};

			this.isUserLoggedIn = function() {
				return localStorage.getItem(me.options.lsUserKey) !== null;
			};

			this.isAllowedListenerWhenLoggedOut = function(listener) {
				return me.allowedListenersWhenLoggedOut.indexOf(listener) != -1
			};

			this.onopen = function(event) {
				if (typeof me.listeners.open != 'undefined') {
					for(var i in me.listeners.open) {
						$(me.listeners.open[i]).trigger('open', [event]);
					}
				}

				window.managedSocket.onclose = function(event) {
					var notification,
						notificationText,
						reconnectionCallback;

					notification = $(me.elements.notification);
					notification.find('#poker-notification-title').html('Verbindung unterbrochen');
					notificationText = notification.find('#poker-notification-text');
					notificationText.html('Versuche die Verbindung wiederherzustellen...');
					notificationText.addClass(me.elements.loaderBackgroundClass);
					notification.show(400);

					me.reconnectionCallback();
				};

				window.managedSocket.onmessage = function(event) {
					var data;
					data = JSON.parse(event.data);

					// If user is logged off and he shall not get the update from the websocket:
					// exit method
					if (!me.isUserLoggedIn() && !me.isAllowedListenerWhenLoggedOut(data.type)) {
						return;
					}

					if (typeof me.listeners[data.type] != 'undefined') {
						for(var i in me.listeners[data.type]) {
							if (typeof me.listeners[data.type][i].onmessage == 'function') {
								me.listeners[data.type][i].onmessage(data);
							}
							$(me.listeners[data.type][i]).trigger(data.type, [data]);
						}
					}

					switch(data.type) {
						case 'userlist':
							me.handleUserList(data.data)
							break;

						case 'carddisplay':
							me.handleCardDisplay(data.data);
							break;

						case 'show-cards':
							me.handleShowCards();
							break;

						case 'userstory':
							me.handleUserstory(data.userstory);
							break;
					}
				}
			};

			this.connect = function() {
				socket = new WebSocket('ws://' + this.options.socket.address + ':' + this.options.socket.port);
				window.managedSocket = socket;
				socket.onopen = this.onopen;
			};

			this.connect();

			this.handleUserList = function(users)  {
				window.currentUsers = users;
				var userArray,
					userArraySorted;

				userArray = [];
				userArraySorted = [];

				// First: Sort the users by role
				// The sorting order is the one given in availableRoles (see index.html for this definition)
				for (var role in options.availableRoles) {
					userArray[role] = [];
				}
				for (userId in users) {
					var span,
						user;

					user = users[userId];
					userArray[user.role].push(user);
				}
				// Second: Create HTML Elements in one one-dimensional array that then is already
				// sorted like we want it
				for (var role in options.availableRoles) {
					for (userId in userArray[role]) {
						user = userArray[role][userId];
						userArraySorted.push('<span class="poker-role poker-role-' + user.role + '">' + user.name.escape() + '</span>');
					}
				}
				// Third: Set logged in users
				$(this.elements.userlist).html(userArraySorted.join(', '));
			};

			/**
				<div class="poker-card-display poker-card-display-hidden">
					<a class="poker-card">8</a>
					<a class="poker-card poker-card-back">
						<img src="img/inovex-logo.png" alt="" />
					</a>
					<span class="poker-card-player">Khalid</a>
				</div>
			*/
			this.handleCardDisplay = function(cardsData) {
				var cardsTotal,
					cards,
					cardsHiddenClass;

				cardsTotal = 0;
				cards = cardsData.cards;
				if (cardsData.show === false) {
					cardsHiddenClass = 'poker-card-display-hidden';
				}

				$(this.elements.pokerFelt).empty();
				$(this.elements.pokerCardsShowButton).attr('disabled', 'disabled');
				for (var userId in cards) {
					var card,
						pokerCardId,
						amountDevs;

					cardsTotal++;

					pokerCardId = 'poker-card-' + userId;
					card = $('#' + pokerCardId);

					if (!card.is('div')) {
						card = $('<div id="' + pokerCardId + '" class="poker-card-display ' + cardsHiddenClass + '">' +
							'<a class="poker-card poker-card-value">#</a>' +
							'<a class="poker-card poker-card-back">' +
								'<img src="img/inovex-logo.png" alt="" />' +
							'</a>' +
							'<span class="poker-card-player">#</a>' +
						'</div>');
						$(this.elements.pokerFelt).append(card);
					}
					card.find('.poker-card-value').html(cards[userId]);
					card.find('.poker-card-player').text(window.currentUsers[userId].name);

					amountDevs = $('.poker-role-developer').length;
					// Schauen, ob alle devs abgestimmt haben
					if (amountDevs > 0 && amountDevs == $('.poker-card-value').length) {
						$(this.elements.pokerCardsShowButton).removeAttr('disabled');
					}
				}
				if (cardsTotal == 0) {
					$('.' + this.elements.pokerCardSelectedClass).removeClass(this.elements.pokerCardSelectedClass);
				};
			}

			this.handleShowCards = function() {
				$('.' + this.elements.showCardsSelectorClass).removeClass(this.elements.showCardsToggleClass);
				$(this.elements.pokerCardsShowButton).attr('disabled', 'disabled');
			}

			this.handleUserstory = function(userstory) {
				userstory = userstory.escape();
				userstory = userstory.parselinks();
				userstory = userstory.nl2br();
				$(this.elements.userstoryText).html(userstory);
				$(this.elements.editUserStoryButton).removeAttr('disabled');
				if (userstory.length > 0) {
					$(this.elements.userstory).show(400);
				}
			};

			return this;
		}
	});
})(jQuery);