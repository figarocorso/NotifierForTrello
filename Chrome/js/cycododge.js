/*
License: http://creativecommons.org/licenses/by-nc-sa/3.0/deed.en_US
  _____                        _             _
 / ____|                      | |           | |
| |     _   _   ___  ___    __| |  ___    __| |  __ _   ___
| |    | | | | / __|/ _ \  / _` | / _ \  / _` | / _` | / _ \
| |____| |_| || (__| (_) || (_| || (_) || (_| || (_| ||  __/
 \_____|\__, | \___|\___/  \__,_| \___/  \__,_| \__, | \___|
		__/  |                                   _/  |
		|___/                                   |___/

http://cycododge.com
http://twitter.com/cycododge
*/
$(function(){
/* Definitions */
	var app = chrome.app.getDetails(), //details about this app
		lastUnread = 0, //the total unread since last check
		redirectURLtoMatch = 'trello.com', //match this to redirect instead of open new tab
		storage = chrome.storage.local,
		$dom = $(document), //DOM cache
		background_page = chrome.extension.getBackgroundPage(),
		user_data = background_page.user_data || {}, //contains object of user data
		note_data = {}, //contains object of note data
		note_structures = [
            ['user', 'user_gone', 'action', 'card_name', 'text-on-board', 'board_name'],
            ['user', 'user_gone', 'action', 'card_name', 'text-on-board', 'board_name', 'mention'],
            ['user', 'user_gone', 'action', 'card_name', 'text-to', 'list_name', 'text-on-board', 'board_name'],
            ['user', 'user_gone', 'action', 'board_name'],
            ['user', 'user_gone', 'action', 'organization'],
            ['user', 'user_gone', 'action', 'card_name', 'text-in', 'list_name', 'text-on-board', 'board_name'],
            ['user', 'user_gone', 'action', 'attached', 'text-to', 'card_name', 'text-on-board', 'board_name'],
            ['user', 'user_gone', 'action', 'checked', 'text-on-card', 'card_name', 'text-on-board', 'board_name']
		],
		note_types = {
			removedFromCard: {text: 'removed you from the card', structure: note_structures[0]},
			addedToCard: {text: 'added you to the card', structure: note_structures[0]},
			mentionedOnCard: {text: 'mentioned you on the card', structure: note_structures[1]},
			commentCard: {text: 'commented on the card', structure: note_structures[1]},
			changeCard: {text: 'moved the card', structure: note_structures[2]},
			createdCard: {text: 'created', structure: note_structures[5]},
			updateCheckItemStateOnCard: {text: 'checked', structure: note_structures[7]},

			addedMemberToCard: {text: 'joined the card', structure: note_structures[0]},
			removedMemberFromCard: {text: 'left the card', structure: note_structures[0]},
			addedAttachmentToCard: {text: 'attached', structure: note_structures[6]},

			addedToBoard: {text: 'added you to the board', structure: note_structures[3]},
			removedFromBoard: {text: 'removed you from the board', structure: note_structures[3]},
			invitedToBoard: {text: 'invited you to the board', structure: note_structures[3]},
			addAdminToBoard: {text: 'made you a co-owner on the board', structure: note_structures[3]},
			makeAdminOfBoard: {text: 'made you a co-owner on the board', structure: note_structures[3]},
			closeBoard: {text: 'closed the board', structure: note_structures[3]},

			removedFromOrganization: {text: 'removed you from the organization', structure: note_structures[4]},
			invitedToOrganization: {text: 'invited you to the organization', structure: note_structures[4]},
			addAdminToOrganization: {text: 'made you an admin on the organization', structure: note_structures[4]},
			makeAdminOfOrganization: {text: 'made you an admin of the organization', structure: note_structures[4]}
	    },

		filters = function(){
            var obj = {};
            for (var i in note_types) {obj[i] = false;}
            obj.unread = false;
            return obj;
        }();


/* Immediate Actions */
    document.title = app.name+' v'+app.version+' Popup';
    $('#login .title').text(app.name+' v'+app.version); //set the text when asking to login

/* Events */

    $dom.on('click','#auth_button',background_page.login);

    $dom.on('click','#btn_logout',function(){
        Trello.deauthorize(); //logout of popup
        background_page.Trello.deauthorize(); //logout from background
        chrome.browserAction.setBadgeText({text:'?'}); //indicate there is an error
        chrome.browserAction.setTitle({title:app.name+' - Authorization Needed'});
        $('#logged_in,#logged_out').toggle(); //hide #logged_in and show #logged_out
    });

    //perform actions when marking note as read/unread
    $dom.on('click','#data .info',function(){
        var toggle = $(this).find('.check'),
            note = $(this).parent('.note');

        if (toggle.hasClass('marked'))
            mark_as_unread(toggle, note);
        else
            mark_as_read(toggle, note);

        update_unread_total_and_badge(true);
        update_unread_total_and_badge_number();
    });

    function mark_as_unread(check, note) {
        Trello.put('notifications/' + note.attr('id'), {unread: true});
        note.addClass('unread');
        check.removeClass('marked');
        check.siblings('.help').text('Mark Read');
        set_internal_note_status(note.attr('id'), true);
    }

    function mark_as_read(check, note) {
        Trello.put('notifications/' + note.attr('id'), {unread: false});
        note.removeClass('unread'); //change styling
        check.addClass('marked').siblings('.help').text('Mark Unread');
        set_internal_note_status(note.attr('id'), false);

        if (filters.unread)
            note.slideUp(400);
    }

    function set_internal_note_status(id, note_status) {
        for (var i in note_data)
            if (note_data[i].id == id) {
                note_data[i].unread = note_status;
                break;
            }
    }

    function update_unread_total_and_badge_number() {
        if (filters.unread) {
            $('#viewing_count .total').text($('.note.unread').length);
        }
    }

    $dom.on('click', '#btn_mark_all', function() {
        $.each($('.note.unread'),function() {
            $(this).find('.info').click();
        });
    });

    //display only unread notes
    $dom.on('click', '#filter_unread', function(){
        $(this).hide(); //hide this button
        $('#filter_all').show(); //replace with filter all button
        output(note_data,{unread:true}); //set the filter
    });

    //display all notes
    $dom.on('click', '#filter_all', function(){
        $(this).hide(); //hide this button
        $('#filter_unread').show(); //replace with filter all button
        output(note_data,{unread:false});
    });

    $dom.on('click',  '#data .note a',  function(e) {
        goToUrl($(this).attr('href'), e);
    });


/* Functions */

	//output cards
	function init(){
		output(background_page.note_data);
		$('#logged_in, #logged_out').toggle();
	}

	//output the notes to the screen
	window.output = function(notes,new_filters){
		note_data = notes; //update global object
		$('#data').empty(); //clear the current set of notes
		var urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig; //detect url

		//if new filters were passed, update current
		for(var i in new_filters){ filters[i] = new_filters[i]; }

		//loop though notes
		for(var index in notes){
			var note = notes[index], //cache this note
				$note = $('<div class="note" id="'+note.id+'"></div>'); //create the html object

			//validate note against filters
			if(filters.unread && !note.unread){ continue; } //unread; skip read notes

			//build a message
			$note.append('<div class="message"><span class="unknown_type">Unsupported Note Type: '+note.type+'</span> <span class="user_gone"></span> <span class="action"></span> <span class="attached"></span> <span class="checked"></span> <span class="text-on-card">on</span> <span class="text-to">to</span> <a class="card_name"></a> <span class="text-in">in</span> <span class="list_name"></span> <span class="text-on-board">on</span> <a class="board_name"></a> <a class="organization"></a> <pre class="mention"></pre> </div><div class="info"><div class="timestamp"></div><div class="status"><div class="help">Mark Unread</div><div class="check"></div></div></div>');

			//if user details exist (not deleted from Trello system)
			if(note.memberCreator && note.memberCreator.username && note.memberCreator.fullName){
				$note.find('.message .user_gone').replaceWith('<a class="user" href="http://trello.com/'+note.memberCreator.username+'">'+note.memberCreator.fullName+'</a>');
			}else{
				$note.find('.message .user_gone').text('[someone]'); //format for non-existing user
			}

			try{ $note.find('.message .action').text(note_types[note.type].text); }catch(e){} //type of note
			try{ //item attached
				if(note.type == 'addedAttachmentToCard'){
					//if the name contains a URL, keep it short.
					var name_output = (note.data.name.match(urlRegex) ? (note.data.url.length > 25 ? note.data.name.slice(0,22)+'...' : name.data.url) : note.data.name);
					$note.find('.message .attached').html('<a href="'+note.data.url+'">'+name_output+'</a>'); //output data
				}
			}catch(e){
				$note.find('.message .attached').html('<span class="unknown">[unknown]</span>'); //don't know what the attachment is
			}
			try{ //item checked (also contains note.data.state == 'complete'. Keep an eye out for other states.
				if(note.type == 'updateCheckItemStateOnCard'){

					//if the name contains a URL, format it and keep it short.
					var name_output = note.data.name.replace(urlRegex,function(url){
						return '<a href="'+url+'">'+(url.length > 25 ? url.slice(0,22)+'...' : url)+'</a>';
					});
					$note.find('.message .checked').html(name_output); //output data
				}
			}catch(e){
				$note.find('.message .checked').html('<span class="unknown">[unknown]</span>'); //don't know what the checked item is
			}
			try{ $note.find('.message .card_name').text(note.data.card.name).attr('href','http://trello.com/card/'+note.data.board.id+'/'+note.data.card.idShort); }catch(e){} //the card the action happened on
			try{ $note.find('.message .list_name').text(note.data.listAfter.name); }catch(e){} //name of list card moved to
			try{ $note.find('.message .list_name').text(note.data.list.name); }catch(e){} //name of list
			try{ $note.find('.message .board_name').text(note.data.board.name).attr('href','http://trello.com/board/'+note.data.board.id); }catch(e){} //the board the note belongs to
			try{ $note.find('.message .organization').text(note.data.organization.name).attr('href','http://trello.com/'+note.data.organization.id); }catch(e){} //link to organization
			try{ //parse @user's and the message - apply to tag
				var msg = note.data.text.replace(/@[a-z]+/gi,function(user){ return '<span class="at other">'+user+'</span>'; }), //style all mentions
					msg = msg.replace('other">@'+user_data.username,'me">@'+user_data.username); //style my mentions
				$note.find('.message .mention').html(msg); //output text
			}catch(e){}
			try{ //format and output the date
				var date = new Date(note.date), //convert to date object
					hour = date.getHours() < 13 ? date.getHours():date.getHours()-12, //hours
					minutes = date.getMinutes() < 10 ? '0'+date.getMinutes():date.getMinutes(), //minutes
					ampm = date.getHours() < 13 ? 'a':'p', //if its morning or evening
					month = date.getMonth()+1,
					day = date.getDate(),
					year = date.getFullYear(),
					output = month + '/' + day + '/' + year + ' @ ' + (hour == 0 ? '12':hour) + ':' + minutes + ampm; //build the string
				$note.find('.info .timestamp').text(output);
			}catch(e){} //date
			if(!note.unread){ //determine if unread
				$note.find('.info .status .check').addClass('marked');
			}else{
				$note.addClass('unread'); //specify unread class for styling
				$note.find('.info .help').text('Mark Read'); //change help text on .info hover
			}

			//if this note has a structure
			try{
				if(note_types[note.type].structure){
				//loop through note structure
					for(var ind in note_types[note.type].structure){
						$note.find('.message .'+note_types[note.type].structure[ind]).show(); //make visisble
					}
				}
			}catch(e){
				$note.find('.message .card_name').show();
				$note.find('.message .unknown_type').append('<br />').show();
			}

			//output note to user
			$('#data').append($note);
		}

		//update note counts
		update_unread_total_and_badge();
		if(!$('#data .note').length){ $('#data').html('<div style="margin-top:20px;">No notifications for this filter!</div>'); } //if no notes displayed
		$('#viewing_count .total').text($('.note').length); //total output
	}; // end output notes to screen

	function update_unread_total_and_badge(suppressSound) {
		var unread_count = 0;
		$.each($('.note.unread'), function(){ unread_count++; });

		storage.get('lastUnread',function(data){
			//load data if it exists
			if(data.hasOwnProperty('lastUnread')){ lastUnread = data.lastUnread; }

			//update the new total
			lastUnread = unread_count;
			storage.set({'lastUnread':lastUnread});
		});


		if(unread_count > 0){
			chrome.browserAction.setBadgeText({text:String(unread_count)}); //update unread count
		}else{
			chrome.browserAction.setBadgeText({text:''}); //remove badge
		}
		$('#unread_count .total').text(unread_count); //update page with total
		if(!unread_count){ $('#unread_count').addClass('zero'); }else{ $('#unread_count').removeClass('zero'); } //change color if unread == 0
	}

	function goToUrl(new_url, e){
        e.preventDefault();

		//find the current tab
		chrome.tabs.getSelected(null, function(tab) {
			//if the current tab is on the correct site AND the new_url matches too
			if(tab.url.indexOf(redirectURLtoMatch) > -1 && new_url.indexOf(redirectURLtoMatch) > -1)
				chrome.tabs.update(tab.id, {url: new_url});
			else
				chrome.tabs.create({url: new_url});
		});
	}

	$('#header').on('click','.twitter.sound',function(){
		//get status of sound
		storage.get('sound',function(v){
			//if the value is false (or doesn't exist), turn it off
			if(!v.sound){
				storage.set({'sound':true});
				$('.twitter.sound .status').text('On');
			}else{
				storage.set({'sound':false});
				$('.twitter.sound .status').text('Off');
			}
		});
	});

/* Page Initialization */
	//if logged in, start the script
	Trello.authorize({interactive:false,success:init});

	//determine if sound if on/off and set appropriately
	storage.get('sound',function(v){
		if(v.sound){
			$('.twitter.sound .status').text('On');
		}else{
			$('.twitter.sound .status').text('Off');
		}
	});
});
