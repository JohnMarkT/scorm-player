const manifestFilename = 'imsmanifest.xml'
const packageFileInput = document.querySelector('#packageFile')
const alertMessage = document.querySelector('#alertMessage')
const courseFrame = document.querySelector('#courseFrame')
const courseList = document.querySelector('#courseList')
const courseListData = JSON.parse(window.localStorage.getItem('courseList') || '[]')

window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem
window.directoryEntry = window.directoryEntry || window.webkitDirectoryEntry

packageFileInput.addEventListener('input', handlePackage)

courseListData.forEach(courseData => {
  addLink(courseData)
})

async function handlePackage({ target }) {
  if (!target.files) {
    return false
  }

  setAlert('')
  courseFrame.src = 'loading.html'

  const [ packageFile, ...otherFiles ] = target.files

  const packageData = await openZip(packageFile)

  if (!packageData) {
    setAlert('Invalid SCORM package')
    courseFrame.src = ''
    return false
  }

  const { zip, title, courseId, launchLink } = packageData
  
  const fileCount = Object.values(zip.files).filter(f => !f.dir).length
  let processedCount = 0

  window.requestFileSystem(
    TEMPORARY,  // replace with PERSISTENT
    1048576,  // replace with total uncompressed
    fs => {
      fs.root.getDirectory(courseId, { create: true })

      Object.entries(zip.files).forEach(async ([path, data], i, arr) => {
        const coursePath = courseId + '/' + path

        if (data.dir) {
          fs.root.getDirectory(coursePath, { create: true })
        } else {
          const blob = await data.async('blob')
          // console.log('TCL ~ file: scripts.js ~ line 21 ~ handlePackage ~ file', path, coursePath)
          // console.log('TCL ~ file: scripts.js ~ line 24 ~ Object.entries ~ blob', blob)
          processedCount += 1
      
          fs.root.getFile(
            coursePath,
            { create: true },
            fileEntry => {
              fileEntry.createWriter(fileWriter => {
                fileWriter.write(blob);
              }, console.warn)
            }
          )
        }

        if (processedCount === fileCount) {
          const [ launchLinkFile, ...launchLinkSearch ] = launchLink.split('?')
          fs.root.getFile(courseId + '/' + launchLinkFile, {}, entry => {
            const entryUrl = [ entry.toURL(), ...launchLinkSearch ].filter(Boolean).join('?')
            // console.log('TCL ~ file: scripts.js ~ line 53 ~ Object.entries ~ entryUrl', entryUrl)
            const courseData = { title, courseId, entryUrl }
            loadCourse(entryUrl)
            addLink(courseData)
            updateStorage(courseData)
          })
        }
      })
    }
  )
}

async function openZip(packageFile) {
  try {
    const zip = await JSZip.loadAsync(packageFile, {createFolders: true})
    console.log('TCL ~ file: scripts.js ~ line 10 ~ handlePackage ~ zip', zip)
    const content = await zip.file(manifestFilename).async('string')
    const parser = new DOMParser()
    const manifest = parser.parseFromString(content.trim(), 'application/xml')
    const organization = manifest.querySelector('organizations organization')
    const titleElement = organization.querySelector('title')
    const courseId = organization.getAttribute('identifier')
    console.log('TCL ~ file: scripts.js ~ line 25 ~ handlePackage ~ courseId', courseId)
    const launchLink = manifest.querySelector('resources resource').getAttribute('href')
    console.log('TCL ~ file: scripts.js ~ line 18 ~ handlePackage ~ launchLink', launchLink)
    const title = titleElement.textContent || ''
    return { zip, title, courseId, launchLink }
  } catch (error) {
    console.warn('Invalid SCORM package')
  }
}

function addLink({ title, courseId, entryUrl }) {
  const existingLink = courseList.querySelector('[data-course-id="' + courseId + '"]')

  if (existingLink) {
    return
  }

  const link = document.createElement('li')
  const text = document.createTextNode(title)

  link.className = 'list-group-item'
  link.appendChild(text)
  link.addEventListener('click', () => { loadCourse(entryUrl) })
  link.dataset.courseId = courseId
  courseList.appendChild(link)
}

function updateStorage(courseData) {
  const courseList = JSON.parse(window.localStorage.getItem('courseList') || '[]')
  if (courseList.some(c => c.courseId === courseData.courseId)) {
    return
  }

  window.localStorage.setItem('courseList', JSON.stringify([...courseList, courseData]))
}

function loadCourse(entryUrl) {
  resetScorm()
  setAlert()
  courseFrame.src = entryUrl
}

function setAlert(msg = '') {
  alertMessage.innerText = msg
  if (msg) {
    alertMessage.classList.remove('d-none')
  } else {
    alertMessage.classList.add('d-none')
  }
}

function resetScorm() {
  window.API.reset()
  window.API_1484_11.reset()
}