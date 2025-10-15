const uploadSection = document.getElementById('uploadSection')
const fileInput = document.getElementById('zipInput')
const output = document.getElementById('output')
const loader = document.getElementById('loader')
let mainError = document.getElementById('mainError')

let isOpening = false // prevents double file picker

uploadSection.addEventListener('click', e => {
  // only trigger if not already opening
  if (!isOpening) {
    isOpening = true
    fileInput.click()
    // reset flag after a moment so next clicks still work
    setTimeout(() => (isOpening = false), 500)
  }
})

uploadSection.addEventListener('dragover', e => {
  e.preventDefault()
  uploadSection.classList.add('dragover')
})

uploadSection.addEventListener('dragleave', () => {
  uploadSection.classList.remove('dragover')
})

uploadSection.addEventListener('drop', e => {
  e.preventDefault()
  uploadSection.classList.remove('dragover')
  fileInput.files = e.dataTransfer.files
  handleFile({ target: fileInput })
  fileInput.value = ''
})

fileInput.addEventListener('change', e => {
  handleFile(e)
  fileInput.value = ''
})

async function handleFile(event) {
  try {
    const file = event.target.files[0]
    if (!file) return
  
    const jszip = new JSZip()
    const zipData = await jszip.loadAsync(file)
  
    const followers = []
    const following = []
  
    let foundFollowers = false

    for (const filename in zipData.files) {
      if (filename.startsWith('connections/followers_and_following/followers_')) {
        const followersJson = await zipData.files[filename].async('string')
        const followersData = JSON.parse(followersJson)
        followers.push(...extractUsernames(followersData))
        foundFollowers = true
      }
    }

    if (!foundFollowers) {
      throw new Error('Could not find followers JSON file. Please upload the correct .zip file.')
    }
  
    const followingPath = 'connections/followers_and_following/following.json'
    if (zipData.files[followingPath]) {
      const followingJson = await zipData.files[followingPath].async('string')
      const followingData = JSON.parse(followingJson)
      following.push(...extractUsernames(followingData))
    } else {
      throw new Error('Could not find following JSON file. Please upload the correct .zip file.')
    }

    mainError.innerHTML = ''
  
    let notFollowingBack = following.filter(f =>
      !followers.some(u => u.username === f.username)
    )
    let youDontFollowBack = followers.filter(f =>
      !following.some(u => u.username === f.username)
    )
  
    const dedupeSort = arr =>
      [...new Map(arr.map(u => [u.username, u])).values()]
        .sort((a, b) => a.username.localeCompare(b.username))
  
    notFollowingBack = dedupeSort(notFollowingBack)
    youDontFollowBack = dedupeSort(youDontFollowBack)
  
    uploadSection.style.display = 'none'
    loader.style.display = 'flex'
  
    setTimeout(() => {
      renderResults(notFollowingBack, youDontFollowBack)
      loader.style.display = 'none'
    }, 1800)
  } catch(error) {
    mainError.innerHTML = error
  }
}

function extractUsernames(jsonData) {
  if (Array.isArray(jsonData)) {
    return jsonData
      .filter(entry => entry.string_list_data && entry.string_list_data.length)
      .map(entry => ({
        username: entry.string_list_data[0].value,
        href: entry.string_list_data[0].href
      }))
  }

  for (const key in jsonData) {
    const arr = jsonData[key]
    if (Array.isArray(arr)) {
      return arr
        .filter(entry => entry.string_list_data && entry.string_list_data.length)
        .map(entry => ({
          username: entry.string_list_data[0].value || entry.title || '',
          href: entry.string_list_data[0].href
        }))
    }
  }

  return []
}

function renderResults(notFollowingBack, youDontFollowBack) {
  output.innerHTML = `
    <div class="result-block fade-in">
      <h2>Not Following You Back (${notFollowingBack.length})</h2>
      <ul>
        ${notFollowingBack
          .map(u => `<li><a href="${u.href}" target="_blank">${u.username}</a></li>`)
          .join('')}
      </ul>
    </div>

    <div class="result-block fade-in">
      <h2>You Don’t Follow Back (${youDontFollowBack.length})</h2>
      <ul>
        ${youDontFollowBack
          .map(u => `<li><a href="${u.href}" target="_blank">${u.username}</a></li>`)
          .join('')}
      </ul>
    </div>
  `
  document.getElementById('downloadCsvBtn').addEventListener('click', () => {
    downloadCSV(notFollowingBack, youDontFollowBack)
  })
  document.getElementById('downloadCsvBtn').style.display = 'block'
  document.getElementById('resetBtn').addEventListener('click', () => {
    output.innerHTML = ''
    uploadSection.style.display = 'flex'
    document.getElementById('downloadCsvBtn').style.display = 'none'
    document.getElementById('resetBtn').style.display = 'none'
  })
  document.getElementById('resetBtn').style.display = 'block'
}

function downloadCSV(notFollowingBack, youDontFollowBack) {
  let csvContent = "data:text/csv;charset=utf-8,"
  csvContent += "Not Following You Back (username),Not Following You Back (link),You Don’t Follow Back (username),You Don’t Follow Back (link)\n"

  const maxLength = Math.max(notFollowingBack.length, youDontFollowBack.length)

  for (let i = 0; i < maxLength; i++) {
    const col1 = notFollowingBack[i]?.username || ""
    const col2 = notFollowingBack[i]?.href || ""
    const col3 = youDontFollowBack[i]?.username || ""
    const col4 = youDontFollowBack[i]?.href || ""
    csvContent += `${col1},${col2},${col3},${col4}\n`
  }

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", "instagram_followers_report.csv")
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}