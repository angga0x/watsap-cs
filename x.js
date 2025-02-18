const axios = require('axios')

async function getDistrict(keyword) {
    try {
        const getDistrictConfig = {
            method: 'get',
            url: `https://api.orderonline.id/shipping/complete_district?get_complete_data=1&keyword=${keyword}&page=1`,
            headers: {
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        };

        const getDistrictResponse = await axios(getDistrictConfig)
        const getDistrictData = getDistrictResponse.data.data

        if (!getDistrictData || getDistrictData.length === 0) {
            throw new Error('Data kecamatan tidak ditemukan')
        }

        const districtDetails = []

        getDistrictData.forEach((data, index) => {
            districtDetails.push({
                nomor: index + 1,
                id_provinsi: data.province_id,
                nama_provinsi: data.province_name,
                nama_kota: data.city_name,
                nama_kecamatan: data.subdistrict_name,
                id_kecamatan: data.subdistrict_id,
                kode_pos: data.zip,
                kota: data.city
            })
        })

        return districtDetails
        // console.log(districtDetails)

    } catch (err) {
        console.log(err)
    }
}

module.exports = getDistrict