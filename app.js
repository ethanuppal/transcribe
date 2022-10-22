// Copyright (C) 2022 Ethan Uppal. All rights reserved.

// THe model for the app.
var model = {
    filename: null,
    fileModified: null,
    sections: [],
    lastID: 0
};
var internal = {
    currentSectionID: null,
    saved: true
};

$(document).ready(function() {
    window.onbeforeunload = function() {
        if (!internal.saved) {
            return "You have unsaved changes on this page. Would you like to leave and discard your changes?"
        }
    }

    window.addEventListener('focusout', function() {
        if (model.filename != null && internal.saved == false) {
            saveProgress();
            internal.saved = true;
        }
    });


    // When audio file is uploaded, load the workspace with that file.
    $("#file-uploader").on("input", function() {
        const files = $(this).prop("files");
        const file = files[0];
        if (!files.length) {
            alert("Please upload a file!");
            return;
        }
        loadWorkspace(file);
    });

    // Play/pause audio
    $("#play-button").on("click", function() {
        // User activated so restore default playing
        internal.currentSectionID = null;

        playAudio(1);

        // Make all the section play buttons turn off.
        pauseSectionPlayButtons();
    });

    // See if URL has workspace data
    internal.urlWorkspace = jsonDecompress(JSON.parse(atob(getUrlParameter('workspace'))));
    if (internal.urlWorkspace) {
        $('#upload-div-msg').text(`Please upload '${internal.urlWorkspace.filename}' to begin.`)
    }
});

function setIconBasedOnAudioPause(icon) {
    if ($("#audio")[0].paused) {
        icon.removeClass("fa-pause");
        icon.addClass("fa-play");
    } else {
        icon.removeClass("fa-play");
        icon.addClass("fa-pause");
    }
}

function pauseSectionPlayButtons() {
    for (const section of model.sections) {
        const id = section.id;
        const playButtonIcon = $(`#play-button-i-${id}`);
        playButtonIcon.removeClass("fa-pause");
        playButtonIcon.addClass("fa-play");
    }
}

function playAudio(speed) {
    const audioDOM = $("#audio")[0];
    if (audioDOM.paused) {
        audioDOM.playbackRate = speed;
        audioDOM.play();
    } else {
        audioDOM.pause();
    }
    const playButtonIcon = $("#play-button-i");
    setIconBasedOnAudioPause(playButtonIcon);
}

function clearWorkspace() {
    model.sections = [];
    $("#section-list").empty();
}

function updateURLTo(newEnding) {
    // https://stackoverflow.com/questions/22753052/remove-url-parameters-without-refreshing-page
    window.history.pushState({}, document.title, `/transcribe${newEnding}`);
}

function saveProgress() {
    updateURLTo(`?workspace=${generateJSONPackage()}`);
}

// https://web.dev/read-files/#select-input
function loadWorkspace(file) {
    // Overwrite workspace if it exists
    clearWorkspace();
    internal.saved = false;

    // Set the model properties.
    model.filename = file.name;
    model.fileModified = file.lastModified;

    // Try to load data.
    if (internal.urlWorkspace) {
         if (!loadFromJSON(internal.urlWorkspace)) {
             return;
         } else {
             internal.urlWorkspace = null;
         }
    }

    // Set the file as the audio source.
    const url = URL.createObjectURL(file);
    $("#audio-src").attr("src", url);

    // Load the audio and configure the player.
    const audio = $("#audio");
    audio[0].load();
    audio.on("canplay canplaythrough", () => {
        configureAudioPlayer(audio);
    });

    $("#workspace").show();
    $("#control-jumper").show();

    $('#upload-div-msg').text('Upload successful!');
}

function secondsToTimestamp(sec) {
    const intSec = Math.floor(sec);
    const secPart = ("00" + `${intSec % 60}`).slice(-2);
    const minPart = ("00" + `${Math.floor(intSec / 60)}`).slice(-2);
    return `${minPart}:${secPart}`;
}

function timestampToSeconds(stamp) {
    const segments = stamp.split(':');
    if (segments.length != 2) {
        return null;
    }
    return parseInt(segments[0]) * 60 + parseInt(segments[1]);
}

function disableAudio(audio) {
    audio.off();
}

function disableSlider(slider) {
    slider.off();
}

function enableAudio(audio) {
    audio.on("timeupdate", updateWorkspaceFromAudio);
    audio.on("ended", updateWorkspaceFromAudio);
}

function enableSlider(slider) {
    slider.on("mousedown", pauseAudio);
    slider.on("input", function() { updateWorkspaceFromSlider(false); });
}

function updateWorkspaceFromSlider(keepSect) {
    const currentTime = $("#audio-slider")[0].value;
    $("#current-timestamp").text(secondsToTimestamp(currentTime));

    if (!keepSect) {
        internal.currentSectionID = null;
    }
    const audio = $("#audio");
    disableAudio(audio);
    audio[0].currentTime = currentTime;
    enableAudio(audio);
}

function updateWorkspaceFromAudio() {
    const audioDOM = $("#audio")[0];
    let currentTime = audioDOM.currentTime;
    if (internal.currentSectionID) {
        const section = getSection(internal.currentSectionID);
        if (section) {
            if (currentTime > section.end) {
                if (section.loop) {
                    currentTime = section.start;
                } else {
                    currentTime = section.end;
                    pauseAudio();
                }
                audioDOM.currentTime = currentTime;
            }
        }
    }

    model.currentTime = currentTime;
    $("#current-timestamp").text(secondsToTimestamp(currentTime));

    const slider = $("#audio-slider");
    disableSlider(slider);
    slider[0].value = currentTime;
    enableSlider(slider);
}

function configureAudioPlayer(audio) {
    // Set slider to 0:00
    const slider = $("#audio-slider");
    slider[0].value = 0;
    $("#current-timestamp").text("00:00");

    // Set slider max to audio duratoin
    const audioDOM = audio[0];
    audioDOM.loop = false;
    const durationInt = Math.ceil(audioDOM.duration);
    const durationString = secondsToTimestamp(durationInt);
    $("#audio-length").text(durationString);
    slider[0].max = audioDOM.duration;

    // Connect slider, timestamps, and audio
    enableSlider(slider);
    enableAudio(audio);
}

function pauseAudio() {
    $("#audio")[0].pause();
    pauseSectionPlayButtons();

    const playButtonIcon = $("#play-button-i");
    playButtonIcon.removeClass("fa-pause");
    playButtonIcon.addClass("fa-play");
}

function backwardSkip() {
    $("#audio-slider")[0].value = 0;
    updateWorkspaceFromSlider(false);
    pauseAudio();
}

function forwardSkip() {
    const slider = $("#audio-slider");
    slider[0].value = slider[0].max;
    updateWorkspaceFromSlider(false);
    pauseAudio();
}

function getSectionIndex(id) {
    for (let i = 0; i < model.sections.length; i++) {
        if (model.sections[i].id == id) {
            return i;
        }
    }
    return -1;
}

function getSection(id) {
    const idx = getSectionIndex(id);
    return idx >= 0 ? model.sections[idx] : null;
}

function deleteSection(id) {
    const idx = getSectionIndex(id);
    if (idx >= 0) {
        const sectionDiv = document.getElementById(`section-${id}`);
        sectionDiv.parentNode.removeChild(sectionDiv);
        model.sections.splice(idx, 1);
    }
}

function makeSectionValid(section) {
    if (section.speed <= 0) {
        section.speed = 1;
        restoreHTMLSection(section);
    }
    if (section.start < 0) {
        section.start = 0;
        restoreHTMLSection(section);
    }
    if (section.end < 0) {
        section.end = 0;
        restoreHTMLSection(section);
    }
    // const duration = $("#audio")[0].duration;
    // if (section.start > duration) {
    //     section.start = duration;
    // }
    // if (section.start > section.end) {
    //     section.end = section.start;
    // }
}

function saveSectionValues(id) {
    const section = getSection(id);
    if (section) {
        section.name = $(`#name-${id}`)[0].value ?? "";
        section.start = timestampToSeconds($(`#start-${id}`)[0].value ?? "") ?? 0;
        section.end = timestampToSeconds($(`#end-${id}`)[0].value ?? "") ?? 0;
        section.speed = $(`#speed-${id}`)[0].value ?? 1;
        section.loop = $(`#loop-${id}`)[0].checked;
        $(`#section-name-${id}`).text(section.name);
        internal.saved = false;
        makeSectionValid(section);
        if (internal.currentSectionID == id) {
            $("#audio")[0].playbackRate = section.speed;
        }
        updateWorkspaceFromAudio();
    }
}

function restoreHTMLSection(section) {
    const id = section.id;
    if (section.name) {
        $(`#name-${id}`)[0].value = section.name;
        $(`#section-name-${id}`).text(section.name);
    }
    if (section.start != null) {
        $(`#start-${id}`)[0].value = secondsToTimestamp(section.start);
    }
    if (section.end != null) {
        $(`#end-${id}`)[0].value = secondsToTimestamp(section.end);
    }
    if (section.speed) {
        $(`#speed-${id}`)[0].value = section.speed;
    }
    if (section.loop !== undefined) {
        $(`#loop-${id}`)[0].checked = section.loop;
    }
}

function restoreHTMLFromSections() {
    for (const section of model.sections) {
        restoreHTMLSection(section);
    }
}

function backwardSkipSection(id) {
    internal.currentSectionID = id;
    const section = getSection(id);
    $("#audio-slider")[0].value = section.start;
    updateWorkspaceFromSlider(true);
}

function playAudioSection(id) {
    internal.currentSectionID = id;

    const section = getSection(id);
    const slider = $("#audio-slider")[0];
    if (slider.value < section.start || slider.value >= section.end) {
        slider.value = section.start;
        updateWorkspaceFromSlider(true);
    }

    playAudio(section.speed);
    pauseSectionPlayButtons();
    setIconBasedOnAudioPause($(`#play-button-i-${id}`));
}

function forwardSkipSection(id) {
    internal.currentSectionID = id;
    const section = getSection(id);
    $("#audio-slider")[0].value = section.end;
    updateWorkspaceFromSlider(true);
}

function createSectionDiv(id) {
    const inputSectionHTML = `
    <label for="name-${id}">Section Name:</label>
    <input type="text" id="name-${id}" name="name-${id}" placeholder="Enter a section name" oninput="saveSectionValues(${id});"><br/>

    <label for="start-${id}">Start (in <em>minute:second</em> format):</label>
    <input type="text" id="start-${id}" name="start-${id}" placeholder="00:00" oninput="saveSectionValues(${id});"><br/>

    <label for="end-${id}">End (in <em>minute:second</em> format):</label>
    <input type="text" id="end-${id}" name="end-${id}" placeholder="00:00" oninput="saveSectionValues(${id});"><br/>

    <label for="speed-${id}">Speed (normal = 1, 50% = 0.5):</label>
    <input type="number" id="speed-${id}" name="speed-${id}" placeholder="Enter a playback speed" value="1" min="0.01" step="0.01" onchange="saveSectionValues(${id});"><br/>

    <label for="loop-${id}">Loop:</label>
    <input type="checkbox" id="loop-${id}" name="loop-${id}" onchange="saveSectionValues(${id});"><br/>`

    const deleteSectionHTML = `<button id="trash-button" class="icon-button" onclick="deleteSection(${id});"><i class="fa-solid fa-trash-can"></i></button>`;

    const controlsSectionHTML = `<button id="backward-skip-button-${id}" class="icon-button" onclick="backwardSkipSection(${id});">
        <i class="fa-solid fa-backward-step"></i>
    </button>
    <button id="play-button" class="icon-button" onclick="playAudioSection(${id});">
        <i id="play-button-i-${id}" class="fa-solid fa-play"></i>
    </button>
    <button id="forward-skip-button" class="icon-button" onclick="forwardSkipSection(${id});">
        <i class="fa-solid fa-forward-step"></i>
    </button>`;

    const finalHTML = `<div class="section" id="section-${id}"><div style="float: right;">${deleteSectionHTML}</div><div class="row">${controlsSectionHTML}<h1 id="section-name-${id}"></h1></div><div>${inputSectionHTML}</div></div>`;

    const sectionListDiv = document.getElementById("section-list");
    sectionListDiv.innerHTML += finalHTML;
}

function addSongSection() {
    model.lastID++;
    createSectionDiv(model.lastID);
    const currentTime = Math.floor($("#audio-slider")[0].value);
    model.sections.push({
        id: model.lastID,
        start: currentTime,
        end: currentTime,
        speed: 1,
        loop: false
    });
    internal.saved = false;
    restoreHTMLFromSections();
}

// https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
function fallbackCopyTextToClipboard(text, onSuccess) {
  var textArea = document.createElement("textarea");
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand('copy');
    var msg = successful ? 'successful' : 'unsuccessful';
    onSuccess();
  } catch (err) {
      alert(`Failed to copy data to clipboard: ${err}`);
    console.error('Fallback: Oops, unable to copy', err);
  }

  document.body.removeChild(textArea);
}
function copyTextToClipboard(text, onSuccess) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text, onSuccess);
}
  navigator.clipboard.writeText(text).then(function() {
    onSuccess();
  }, function(err) {
      alert(`Failed to copy data to clipboard: ${err}`);
  });
}

function copySections() {
    model.currentTime = $("#audio")[0].currentTime;
    const json = JSON.stringify(model);
    copyTextToClipboard(json, () => {
        internal.saved = true;
        alert("Section code copied! Paste it into a note or document you can easily access.");
    });
}

function pasteIntoBox() {
    (async () => {
        if (!navigator.clipboard.readText) {
            alert("Your browser does not allow automatic pasting. Please paste the section code manually.");
        } else {
            const text = await navigator.clipboard.readText();
            $('#input-sections')[0].value = text;
        }
    })()
}

function pasteSections() {
    const data = document.getElementById("input-sections").value;
    const object = JSON.parse(data);
    loadFromJSON(object);
}

function generateJSONPackage() {
    model.currentTime = $("#audio")[0].currentTime;
    return btoa(JSON.stringify(jsonCompress(model)));
}

function generatePermaLink() {
    const json = generateJSONPackage();
    return `https://ethanuppal.github.io/transcribe/?workspace=${json}`;
}

function copyPermaLink() {
    copyTextToClipboard(generatePermaLink(), () => {
        internal.saved = true;
        alert("Link copied! Please note that while the link contains your workspace, it does not contain the audio file. However, once you go to the link and upload the right audio file, everything will already be ready.");
    });
}

function loadFromJSON(object) {
    if (!object.override) {
        if (object.filename && object.fileModified) {
            if (model.filename != object.filename || model.fileModified != object.fileModified) {
                if (internal.urlWorkspace) {
                    alert("The link requires a specific audio file to work. To upload a different audio file, remove the extra parts of the URL or go to ethanuppal.github.io/transcribe.");
                } else {
                    alert("The section code was saved for a different audio file or a previous version of the audio file. To circumvent this verification check, paste the following text into the code before the final closing brace '}'\n\n,\"override\":true");
                }
                return false;
            }
        } else {
            if (internal.urlWorkspace) {
                alert("The link is malformed. Please generate a new one.");
            } else {
                alert("The section code is corrupted: missing verification info. To circumvent this verification check, paste the following text into the code before the final closing brace '}'\n\n,\"override\":true");
            }
            return false;
        }
    }
    if (object.lastID != null) {
        model.lastID = object.lastID;
    } else {
        if (internal.urlWorkspace) {
            alert("The link is malformed. Please generate a new one.");
        } else {
            alert("The section code is corrupted: missing id generator.");
        }
        return false;
    }
    if (object.sections) {
        clearWorkspace();
        model.sections = object.sections;
        for (const section of model.sections) {
            createSectionDiv(section.id);
        }
        restoreHTMLFromSections();
        if (object.currentTime) {
            $("#audio")[0].currentTime = object.currentTime;
        }
        internal.saved = false;
        return true
    } else {
        alert("The section code is corrupted: missing sections content.");
        return false;
    }
}

function jsonCompress(object) {
    return {
        f: object.filename,
        m: object.fileModified,
        i: object.lastID,
        t: object.currentTime,
        s: object.sections.map((section) => {
            return {
                i: section.id,
                n: section.name,
                s: section.start,
                e: section.end,
                S: section.speed,
                l: section.loop
            };
        })
    };
}


function jsonDecompress(object) {
    return {
        filename: object.f,
        fileModified: object.m,
        lastID: object.i,
        currentTime: object.t,
        sections: object.s.map((section) => {
            return {
                id: section.i,
                name: section.n,
                start: section.s,
                end: section.e,
                speed: section.S,
                loop: section.l
            };
        })
    };
}
